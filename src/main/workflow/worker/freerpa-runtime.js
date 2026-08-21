/**
 * @file: freerpa 运行时 API（插件 `import {inputs,config,complete,next,wait} from 'freerpa'` 的映射目标）
 * 经 worker import-map 的 "freerpa" → 本文件 解析。
 *
 * 采用 AsyncLocalStorage 实现「按执行实例隔离」的运行上下文：
 *   - 每个插件执行实例在独立的异步上下文中运行（pluginCall 用 __runWithPluginContext 包裹）；
 *   - complete / next / wait 读取当前异步上下文中的回调；
 *   - inputs / config 通过 Proxy 从当前异步上下文动态读取。
 * 从而多个插件并发执行时互不覆盖上下文，天然支持插件并发（此前模块级单例 ctx 会互相覆盖，
 * 表现为「一个完成、另一个不能完成」）。
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

/** 在独立的异步上下文中注入运行上下文并执行 fn（插件执行体） */
export const __runWithPluginContext = (nextCtx = {}, fn) =>
  als.run({ ...defaultCtx, ...nextCtx }, fn)

/** 读取当前异步上下文（回退到默认空上下文） */
const currentCtx = () => als.getStore() || defaultCtx

/** 完成执行并输出结果到下游节点 */
export const complete = (outputs) => currentCtx().complete(outputs)
/** 跳过当前节点，执行下一个节点 */
export const next = (outputs) => currentCtx().next(outputs)
/** 延时等待（毫秒） */
export const wait = (ms) => currentCtx().wait(ms)

/** 构造从当前异步上下文动态取值的代理（inputs/config 顶层解构拿到同一引用，但访问时按实例取值） */
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