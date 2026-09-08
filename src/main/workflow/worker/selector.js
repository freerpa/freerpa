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
 * 统一使用 handle.evaluate 求值，页面与元素得到的 handle 均适用。
 */
async function preferVisible(handles) {
  if (!handles.length) return handles
  const vis = new Set()
  const dead = new Set()
  await Promise.all(handles.map(async (h, i) => {
    try {
      const ok = await h.evaluate((el) => {
        if (!el || el.nodeType !== 1) return false
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || 1) > 0
      })
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

// root 可为 Page 或 ElementHandle：二者均有 $$；waitForSelector 仅 Page 具备（元素级不等待）
async function findByCss(root, expr, opts) {
  try {
    if (opts.wait && root.waitForSelector) await root.waitForSelector(expr) // 仅等待元素出现，不要求可见
    return root.$$(expr)
  } catch { return [] }
}

async function findByXPath(root, expr, opts) {
  try {
    const pseudo = `::-p-xpath(${expr})`
    if (opts.wait && root.waitForSelector) await root.waitForSelector(pseudo) // 仅等待元素出现，不要求可见
    return root.$$(pseudo)
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
  const handles = await preferVisible(await fn(page, element.selectors, opts)) // 统一可见优先，覆盖全部 finder
  return opts.all ? handles : (handles[0] || null)
}

// ─── 元素级（子元素）选择器解析 ───────────────────────────────
// 文本选择器（相对当前元素，作用于其子孙）
const subTextXPath = (subtype, q) => {
  const map = {
    contains: `.//*[contains(normalize-space(text()), ${q})]`,
    equals: `.//*[normalize-space(text()) = ${q}]`,
    start: `.//*[starts-with(normalize-space(text()), ${q})]`,
    end: `.//*[substring(normalize-space(text()), string-length(normalize-space(text())) - string-length(${q}) + 1) = ${q}]`
  }
  return map[subtype]
}

// 在目标元素相对作用域内解析单个选择器（仅 css / xpath / text；position/image 为页面坐标语义，子元素无意义）
async function resolveOnElement(el, sel) {
  const expr = sel.expression || ''
  try {
    if (sel.type === 'css') return el.$$(expr)
    if (sel.type === 'xpath') return el.$$(`::-p-xpath(${expr})`)
    if (sel.type === 'text') {
      const xp = subTextXPath(sel.text_subtype, quote(expr))
      return xp ? el.$$(`::-p-xpath(${xp})`) : []
    }
  } catch { /* 忽略禁用的选择器类型 */ }
  return []
}

/**
 * element.find(element, { all?, wait? }) — 相对元素解析子元素
 * @returns {ElementHandle | ElementHandle[] | null}
 */
export async function findInElement(el, element, opts = { all: false }) {
  if (!element?.selectors?.length) return opts.all ? [] : null
  const groups = []
  for (const sel of element.selectors) groups.push(await resolveOnElement(el, sel))
  let handles
  if (element.match_condition === 'all') {
    if (groups.some((g) => !g.length)) return opts.all ? [] : null
    handles = groups.flat()
  } else {
    handles = groups.find((g) => g.length) || []
  }
  const alive = await preferVisible(handles)
  return opts.all ? alive : (alive[0] || null)
}

/**
 * 挂载 find 到 puppeteer.Page.prototype 与 ElementHandle.prototype
 * 注意：puppeteer-core 是 ESM 包，Page/ElementHandle 为命名导出（default 导出的 .Page 为 undefined）
 */
export function mountFinder(Page, ElementHandle) {
  const pageProto = Page?.prototype
  if (pageProto) pageProto.find ??= async function (element, opts) { return find(this, element, opts) }
  const elProto = ElementHandle?.prototype
  if (elProto) elProto.find ??= async function (element, opts) { return findInElement(this, element, opts) }
}
