/**
 * @file: freerpa 运行时 API（插件 `import {inputs,config,complete,next,wait} from 'freerpa'` 的映射目标）
 * 经 worker import-map 的 "freerpa" → 本文件 解析。
 *
 * 双上下文策略，兼容两套插件执行路径：
 *  1) 旧路径（正式版 pluginCall）：用 __runWithPluginContext 把 {inputs,config,complete,next,wait}
 *     注入 AsyncLocalStorage 上下文，config/inputs 经 Proxy 从当前上下文动态读取。
 *  2) 新路径（开发版 pluginCall）：每实例 data-URL 隔离 + 重写 'freerpa' → 实例运行时；
 *     但插件经相对导入引入的子模块里若仍有裸 `from 'freerpa'`，会解析到本共享运行时。
 *     此时由 pluginCall 先 __bindInstance(uid) 绑定当前实例，本运行时即从
 *     globalThis.__freerpaInstances[uid] 读取，避免命中空默认值。
 */
import { AsyncLocalStorage } from 'node:async_hooks'

const als = new AsyncLocalStorage()

const defaultCtx = {
  inputs: {},
  config: {},
  complete: () => {},
  next: () => {},
  wait: async () => {}
}

/** 新路径：当前绑定的插件执行实例 uid（pluginCall 在导入插件前设置，执行完解绑） */
let boundUid = null

/** 绑定当前插件执行实例（新路径 pluginCall 调用） */
export const __bindInstance = (uid) => {
  boundUid = uid
}
/** 解绑（避免串扰后续执行实例） */
export const __unbindInstance = () => {
  boundUid = null
}

/**
 * 读取当前上下文：
 *  1) AsyncLocalStorage 有上下文 → 旧路径注入的实例上下文；
 *  2) 否则有绑定实例（globalThis.__freerpaInstances[uid]）→ 新路径实例上下文；
 *  3) 兜底默认空上下文。
 */
const currentCtx = () => {
  const store = als.getStore()
  if (store) return store
  if (boundUid != null) {
    const inst = globalThis.__freerpaInstances?.[boundUid]
    if (inst) return inst
  }
  return defaultCtx
}

/** 在独立的异步上下文中注入运行上下文并执行 fn（旧路径插件执行体） */
export const __runWithPluginContext = (nextCtx = {}, fn) =>
  als.run({ ...defaultCtx, ...nextCtx }, fn)

/** 完成执行并输出结果到下游节点 */
export const complete = (outputs) => currentCtx().complete(outputs)
/** 跳过当前节点，执行下一个节点 */
export const next = (outputs) => currentCtx().next(outputs)
/** 延时等待（毫秒） */
export const wait = (ms) => currentCtx().wait(ms)

/** 构造从当前上下文动态取值的代理（inputs/config 顶层解构拿到同一引用，但访问时按实例取值） */
const contextProxy = (key) =>
  new Proxy(
    {},
    {
      get: (_t, prop) => currentCtx()[key]?.[prop],
      has: (_t, prop) => prop in (currentCtx()[key] || {}),
      ownKeys: () => Reflect.ownKeys(currentCtx()[key] || {}),
      getOwnPropertyDescriptor: (_t, prop) =>
        Reflect.getOwnPropertyDescriptor(currentCtx()[key] || {}, prop)
    }
  )

/** 工作流节点输入（当前执行实例） */
export const inputs = contextProxy('inputs')
/** 工作流节点配置（当前执行实例） */
export const config = contextProxy('config')