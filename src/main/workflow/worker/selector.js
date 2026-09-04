/**
 * @file: Finder（worker 版）— 挂载 page.find 到 puppeteer.Page.prototype
 * 除图片选择器外均为纯 puppeteer 操作；图片匹配经主进程 RPC（sharp 原生模块在主进程）。
 */
import { bridge } from './bridge.js'

/**
 * 可见性排序：在匹配到的结果中优先返回可见元素，但不可见元素不剔除（保留原顺序兜底）。
 * 避免 waitForSelector(visible:true) 因元素隐藏（如 input[type=file]、透明/零尺寸按钮）而误判为不存在。
 * 关键：可见性检查失败的 handle（已 detached / 句柄失效）必须从结果剔除——
 * 否则残留的失效 handle 会在后续节点操作时报 "Node is detached from document"。
 */
async function preferVisible(page, handles) {
  if (!handles.length) return handles
  const vis = new Set()
  const dead = new Set()
  await Promise.all(handles.map(async (h, i) => {
    try {
      const ok = await page.evaluate((el) => {
        if (!el || el.nodeType !== 1) return false
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || 1) > 0
      }, h)
      if (ok) vis.add(i)
    } catch {
      // 句柄已失效（detached）：标记并从结果剔除，避免后续操作报错
      dead.add(i)
    }
  }))
  if (!vis.size) {
    // 无可判定可见的元素：剔除已失效的 handle，其余（可能不可见但有效）保留
    const alive = handles.filter((_, i) => !dead.has(i))
    return alive.length ? alive : handles
  }
  const visible = []
  const invisible = []
  handles.forEach((h, i) => {
    if (dead.has(i)) return // 失效 handle 直接丢弃
    ;(vis.has(i) ? visible : invisible).push(h)
  })
  return [...visible, ...invisible]
}

async function findByCss(page, expr, opts) {
  try {
    if (opts.wait) await page.waitForSelector(expr) // 仅等待元素出现，不要求可见
    return page.$$(expr)
  } catch { return [] }
}

async function findByXPath(page, expr, opts) {
  try {
    const pseudo = `::-p-xpath(${expr})`
    if (opts.wait) await page.waitForSelector(pseudo) // 仅等待元素出现，不要求可见
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
  if (!selectors.length) return []
  // 并行解析：任一选择器命中立即返回，不等待其余完成；全部完成后仍未命中则返回空
  let resolveHit, resolveDone
  const hit = new Promise((r) => { resolveHit = r })
  const allDone = new Promise((r) => { resolveDone = r })
  let pending = selectors.length

  for (const sel of selectors) {
    resolve(page, sel, opts)
      .then((h) => { if (h.length) resolveHit(h) })
      .catch(() => {})
      .finally(() => { if (--pending === 0) resolveDone() })
  }

  return Promise.race([hit, allDone]).then((r) => r || [])
}

async function matchAll(page, selectors, opts) {
  if (!selectors.length) return []
  // 并行解析所有选择器，任一为空则整体不匹配
  const results = await Promise.all(selectors.map((sel) => resolve(page, sel, opts)))
  for (const h of results) if (!h.length) return []
  const seen = new Set()
  return results.flat().filter((h) => (seen.has(h) ? false : (seen.add(h), true)))
}

/**
 * page.find(element, { all?, wait? })
 * @returns {ElementHandle | ElementHandle[] | null}
 */
export async function find(page, element, opts = { all: false, wait: true }) {
  if (!element?.selectors?.length) return opts.all ? [] : null
  const fn = element.match_condition === 'all' ? matchAll : matchAny
  const handles = await preferVisible(page, await fn(page, element.selectors, opts)) // 统一可见优先，覆盖全部 finder
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
