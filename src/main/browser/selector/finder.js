/**
 * @file: Finder — Puppeteer 自定义元素查找器
 *
 * page.find(element, { all?, wait? })
 *   element = { name, match_condition: 'any'|'all',
 *              selectors: [{ type, text_subtype, expression }] }
 *   all  = false → ElementHandle | null
 *   all  = true  → ElementHandle[]
 *   wait = true  → 等待元素出现再查找
 */

import { matchTemplate } from './imageMatcher.js'

// ─── 查找器 ────────────────────────────────────────────

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
  const [cx, cy] = expr.split(',').map(s => parseInt(s.trim(), 10))
  if (isNaN(cx) || isNaN(cy)) return []
  try {
    const handle = await page.evaluateHandle((x, y) => {
      const el = document.elementFromPoint(x, y)
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        if (parseFloat(getComputedStyle(e).opacity || 1) > 0) return e
      }
      return null
    }, cx, cy)
    const tag = await handle.evaluate(el => el?.tagName || '')
    if (!tag) { await handle.dispose(); return [] }
    return [handle]
  } catch { return [] }
}

async function findByImage(page, expression) {
  try {
    const [raw, dpr] = await Promise.all([
      page.screenshot({ encoding: 'base64', type: 'png' }),
      page.evaluate(() => window.devicePixelRatio || 1)
    ])
    const m = await matchTemplate(`data:image/png;base64,${raw}`, expression)
    if (!m) return []
    return findByPoint(page, `${Math.round((m.x + (m.width >> 1)) / dpr)},${Math.round((m.y + (m.height >> 1)) / dpr)}`)
  } catch { return [] }
}

// ─── 分发 ──────────────────────────────────────────────

function quote(s) {
  return s.includes("'") ? "concat('" + s.replace(/'/g, "',\"'\",'") + "')" : `'${s}'`
}

const FINDERS = { css: findByCss, xpath: findByXPath, text: findByText, position: findByPoint, image: findByImage }

async function resolve(page, sel, opts) {
  const fn = FINDERS[sel.type]
  if (!fn) return []
  return sel.type === 'text' ? fn(page, sel.text_subtype, sel.expression, opts) : fn(page, sel.expression, opts)
}

// ─── 匹配模式 ──────────────────────────────────────────

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
  return groups.flat().filter(h => seen.has(h) ? false : (seen.add(h), true))
}

// ─── 对外 API ──────────────────────────────────────────

/**
 * @param {object} page
 * @param {object} element — { name, match_condition, selectors }
 * @param {object} [opts]
 * @param {boolean} [opts.all=false] — true 返回全部, false 返回首个
 * @param {boolean} [opts.wait=true] — 是否等待元素出现
 * @returns {ElementHandle | ElementHandle[] | null}
 */
export async function find(page, element, opts = {all: false, wait: true}) {
  if (!element?.selectors?.length) return opts.all ? [] : null
  const fn = element.match_condition === 'all' ? matchAll : matchAny
  const handles = await fn(page, element.selectors, opts)
  return opts.all ? handles : (handles[0] || null)
}
