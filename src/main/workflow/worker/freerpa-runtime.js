/**
 * @file: freerpa 运行时 API（插件 `import {inputs,config,complete,next,wait} from 'freerpa'` 的映射目标）
 * 经 worker import-map 的 "freerpa" → 本文件 解析。
 * 运行上下文由 pluginCall 执行器在每次加载插件前调用 __setRuntimeContext 注入：
 *   - inputs / config：工作流节点输入与配置快照（ESM live binding，插件顶层解构即取到当前值）
 *   - complete / next / wait：与工作流交互（透传执行上下文）
 */

let ctx = {
  inputs: {},
  config: {},
  complete: () => {},
  next: () => {},
  wait: async () => {}
}

/** 注入运行上下文（执行器每次执行插件前调用） */
export const __setRuntimeContext = (nextCtx = {}) => {
  inputs = nextCtx.inputs || {}
  config = nextCtx.config || {}
  if (typeof nextCtx.complete === 'function') ctx.complete = nextCtx.complete
  if (typeof nextCtx.next === 'function') ctx.next = nextCtx.next
  if (typeof nextCtx.wait === 'function') ctx.wait = nextCtx.wait
}

export let inputs = {}
export let config = {}

/** 完成执行并输出结果到下游节点 */
export const complete = (outputs) => ctx.complete(outputs)
/** 跳过当前节点，执行下一个节点 */
export const next = (outputs) => ctx.next(outputs)
/** 延时等待（毫秒） */
export const wait = (ms) => ctx.wait(ms)
