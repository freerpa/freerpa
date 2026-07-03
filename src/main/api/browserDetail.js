/**
 * @file: 浏览器详情（本地 SQLite）
 * @author: FreeRPA
 *
 * 从本地数据层获取浏览器，替代远程 API
 */

import { getBrowser } from '../data/browsers'

export const getBrowserDetail = async (id) => {
  const row = await getBrowser(id)
  if (!row) return null

  const config = (() => {
    try { return typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}) }
    catch { return {} }
  })()

  return {
    ...config,
    id: row.id,
    name: row.name,
    proxy_url: row.proxy_url,
    kernel_id: row.kernel_id,
  }
}
