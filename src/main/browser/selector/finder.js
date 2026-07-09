/**
 * @file: Finder — Puppeteer 自定义元素查找器
 *
 * page.find(json)     → 返回第一个匹配的 ElementHandle | null
 * page.findAll(json)  → 返回所有匹配的 ElementHandle[]
 *
 * json = JSON.stringify({ match_condition: 'any'|'all',
 *         selectors: [{ type, text_subtype, expression }] })
 */

import { matchTemplate } from './imageMatcher.js'

// ─── 查找器（统一返回 ElementHandle[]）──────────────────

async function findByCss(page, expr) {
  try {
    await page.waitForSelector(expr, { visible: true })
    return page.$$(expr)
  } catch { return [] }
}

async function findByXPath(page, expr) {
  try {
    const pseudo = `::-p-xpath(${expr})`
    await page.waitForSelector(pseudo, { visible: true })
    return page.$$(pseudo)
  } catch { return [] }
}

async function findByText(page, subtype, expr) {
  const map = {
    start:    `//body//*[starts-with(normalize-space(text()), ${quote(expr)})]`,
    end:      `//body//*[substring(normalize-space(text()), string-length(normalize-space(text())) - string-length(${quote(expr)}) + 1) = ${quote(expr)}]`,
    equals:   `//body//*[normalize-space(text()) = ${quote(expr)}]`,
    contains: `//body//*[contains(normalize-space(text()), ${quote(expr)})]`
  }
  return map[subtype] ? findByXPath(page, map[subtype]) : []
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
    const raw = await page.screenshot({ encoding: 'base64', type: 'png' })
    const m = matchTemplate(`data:image/png;base64,${raw}`, expression)
    if (!m) return []
    return findByPoint(page, `${m.x + (m.width >> 1)},${m.y + (m.height >> 1)}`)
  } catch { return [] }
}

// ─── 分发 ──────────────────────────────────────────────

function quote(s) {
  return s.includes("'") ? "concat('" + s.replace(/'/g, "',\"'\",'") + "')" : `'${s}'`
}

const FINDERS = { css: findByCss, xpath: findByXPath, text: findByText, position: findByPoint, image: findByImage }

async function resolve(page, sel) {
  const fn = FINDERS[sel.type]
  if (!fn) return []
  return sel.type === 'text' ? fn(page, sel.text_subtype, sel.expression) : fn(page, sel.expression)
}

// ─── 匹配模式 ──────────────────────────────────────────

async function matchAny(page, selectors) {
  for (const sel of selectors) {
    const h = await resolve(page, sel)
    if (h.length) return h
  }
  return []
}

async function matchAll(page, selectors) {
  if (!selectors.length) return []
  const groups = []
  for (const sel of selectors) {
    const h = await resolve(page, sel)
    if (!h.length) return []
    groups.push(h)
  }
  const seen = new Set()
  return groups.flat().filter(h => seen.has(h) ? false : (seen.add(h), true))
}

function parse(json) {
  try { return JSON.parse(json) } catch { return null }
}

// ─── 对外 API ──────────────────────────────────────────

export async function find(page, json) {
  const el = parse(json)
  if (!el?.selectors?.length) return null
  const handles = await (el.match_condition === 'all' ? matchAll : matchAny)(page, el.selectors)
  return handles[0] || null
}

export async function findAll(page, json) {
  const el = parse(json)
  if (!el?.selectors?.length) return []
  return (el.match_condition === 'all' ? matchAll : matchAny)(page, el.selectors)
}
