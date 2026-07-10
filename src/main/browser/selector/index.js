/**
 * @file: Selector 模块统一导出
 */

export { find } from './finder.js'
export { matchTemplate } from './imageMatcher.js'

import { find as _find } from './finder.js'

/** 挂载 find 到 puppeteer.Page.prototype */
export function mountFinder(puppeteer) {
  const proto = puppeteer?.Page?.prototype
  if (!proto) return

  proto.find ??= async function (element, opts) { return _find(this, element, opts) }
}
