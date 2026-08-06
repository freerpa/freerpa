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

/** 本地插件节点前缀（与渲染端 src/renderer/src/workflow/nodes/index.js 的 PLUGIN_NODE_PREFIX 保持一致） */
const PLUGIN_NODE_PREFIX = 'plu_'

/**
 * plu_ 前缀的本地插件节点没有独立执行器目录（渲染端动态注册），
 * 统一复用 pluginCall 执行器（按其 config.pluginId + _pluginVersion 定位插件目录执行）
 */
const resolveExecutorType = (type) =>
  type && type.startsWith(PLUGIN_NODE_PREFIX) ? 'pluginCall' : type

/** 加载节点执行器（execute.js 的 default 导出），带缓存 */
export async function loadNodeExecutor(type, version) {
  const key = `${type}|${version || 'V1'}`
  if (cache.has(key)) return cache.get(key)
  const executorType = resolveExecutorType(type)
  const file = path.join(nodesRoot, executorType, version || 'V1', 'execute.js')
  const mod = await import(pathToFileURL(file).href)
  const fn = mod.default
  if (typeof fn !== 'function') throw new Error(`节点模块无默认导出函数: ${type}`)
  cache.set(key, fn)
  return fn
}
