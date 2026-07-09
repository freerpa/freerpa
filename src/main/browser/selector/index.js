/**
 * @file: Selector 模块统一导出
 */

export { find, findAll } from './finder.js'
export { matchTemplate } from './imageMatcher.js'

import { find as _find, findAll as _findAll } from './finder.js'

/**
 * 挂载 find / findAll 到 puppeteer.Page.prototype
 */
export function mountFinder(puppeteer) {
  const proto = puppeteer?.Page?.prototype
  if (!proto) return

  proto.find ??= async function (json) { return _find(this, json) }
  proto.findAll ??= async function (json) { return _findAll(this, json) }
}
