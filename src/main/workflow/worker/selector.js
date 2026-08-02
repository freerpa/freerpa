/**
 * @file: Finder（worker 版）— 挂载 page.find 到 puppeteer.Page.prototype
 * 除图片选择器外均为纯 puppeteer 操作；图片匹配经主进程 RPC（sharp 原生模块在主进程）。
 */
import { bridge } from './bridge.js'

async function findByCss(page, expr, opts) {
  try {
    if (opts.wait) await page.waitForSelector(expr, { visible: true })
    return page.$$(expr)
  } catch { return [] }
}

async function findByXPath(page, expr, opts) {
  try {
    const pseudo = `::-p-xpath(${expr})`
    if (opts.wait) await page.waitForSelector(pseudo, { visible: true })
    return page.$$(pseudo)
  } catch { return [] }
}

async function findByText(page, subtype, expr, opts) {
  const map = {
    start: `//body//*[starts-with(normalize-space(text()), ${quote(expr)})]`,
    end: `//body//*[substring(normalize-space(text()), string-length(normalize-space(text())) - string-length(${quote(expr)}) + 1) = ${quote(expr)}]`,
    equals: `//body//*[normalize-space(text()) = ${quote(expr)}]`,
    contains: `//body//*[contains(normalize-space(text()), ${quote(expr)})]`
  }
  return map[subtype] ? findByXPath(page, map[subtype], opts) : []
}

async function findByPoint(page, expr) {
  const [cx, cy] = expr.split(',').map((s) => parseInt(s.trim(), 10))
  if (isNaN(cx) || isNaN(cy)) return []
  try {
    const handle = await page.evaluateHandle((x, y) => {
      const el = document.elementFromPoint(x, y)
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        if (parseFloat(getComputedStyle(e).opacity || 1) > 0) return e
      }
      return null
    }, cx, cy)
    const tag = await handle.evaluate((el) => el?.tagName || '')
    if (!tag) { await handle.dispose(); return [] }
    return [handle]
  } catch { return [] }
}

// 图片选择器：截屏在 worker 内完成，匹配经主进程 RPC（sharp）
async function findByImage(page, expression) {
  try {
    const [raw, dpr] = await Promise.all([
      page.screenshot({ encoding: 'base64', type: 'png' }),
      page.evaluate(() => window.devicePixelRatio || 1)
    ])
    const m = await bridge.rpc('matchTemplate', `data:image/png;base64,${raw}`, expression)
    if (!m) return []
    return findByPoint(page, `${Math.round((m.x + (m.width >> 1)) / dpr)},${Math.round((m.y + (m.height >> 1)) / dpr)}`)
  } catch { return [] }
}

function quote(s) {
  return s.includes("'") ? "concat('" + s.replace(/'/g, "',\"'\",'") + "')" : `'${s}'`
}

const FINDERS = { css: findByCss, xpath: findByXPath, text: findByText, position: findByPoint, image: findByImage }

async function resolve(page, sel, opts) {
  const fn = FINDERS[sel.type]
  if (!fn) return []
  return sel.type === 'text' ? fn(page, sel.text_subtype, sel.expression, opts) : fn(page, sel.expression, opts)
}

async function matchAny(page, selectors, opts) {
  for (const sel of selectors) {
    const h = await resolve(page, sel, opts)
    if (h.length) return h
  }
  return []
}

async function matchAll(page, selectors, opts) {
  if (!selectors.length) return []
  const groups = []
  for (const sel of selectors) {
    const h = await resolve(page, sel, opts)
    if (!h.length) return []
    groups.push(h)
  }
  const seen = new Set()
  return groups.flat().filter((h) => (seen.has(h) ? false : (seen.add(h), true)))
}

/**
 * page.find(element, { all?, wait? })
 * @returns {ElementHandle | ElementHandle[] | null}
 */
export async function find(page, element, opts = { all: false, wait: true }) {
  if (!element?.selectors?.length) return opts.all ? [] : null
  const fn = element.match_condition === 'all' ? matchAll : matchAny
  const handles = await fn(page, element.selectors, opts)
  return opts.all ? handles : (handles[0] || null)
}

/**
 * 挂载 find 到 puppeteer.Page.prototype
 * 注意：puppeteer-core 是 ESM 包，Page 为命名导出（default 导出的 .Page 为 undefined）
 */
export function mountFinder(Page) {
  const proto = Page?.prototype
  if (!proto) return
  proto.find ??= async function (element, opts) { return find(this, element, opts) }
}
