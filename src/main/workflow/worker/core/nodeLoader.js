/**
 * @file: 节点执行器加载器（worker 版）
 * 节点目录由 init 命令注入（prod 为 resources/worker/nodes，dev 为渲染源码目录），
 * 布局统一为 {type}/{version}/execute.js。
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

let nodesRoot = new URL('../nodes/', import.meta.url).pathname

export const setNodesRoot = (root) => {
  if (root) nodesRoot = root
}

const cache = new Map()

/** 加载节点执行器（execute.js 的 default 导出），带缓存 */
export async function loadNodeExecutor(type, version) {
  const key = `${type}|${version || 'V1'}`
  if (cache.has(key)) return cache.get(key)
  const file = path.join(nodesRoot, type, version || 'V1', 'execute.js')
  const mod = await import(pathToFileURL(file).href)
  const fn = mod.default
  if (typeof fn !== 'function') throw new Error(`节点模块无默认导出函数: ${type}`)
  cache.set(key, fn)
  return fn
}
