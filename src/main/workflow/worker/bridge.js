/**
 * @file: 工作流 Worker 内消息桥（engine.js / 节点执行器共用）
 *  - invoke 命令分发（宿主 → worker）
 *  - rpc 调用主进程 electronAPI（worker → 宿主 → 主进程）
 *  - 事件发送/监听（渲染进程双向）
 */
import { MSG } from './protocol.js'

const post = (msg) => self.postMessage(msg)

const pending = new Map() // rpc id → { resolve, reject }
const invokeHandlers = new Map() // method → handler
const eventListeners = new Map() // channel → Set<cb>
let seq = 0

self.onmessage = (evt) => {
  const msg = evt.data
  switch (msg.type) {
    case MSG.INVOKE: {
      const handler = invokeHandlers.get(msg.method)
      if (!handler) {
        return post({ type: MSG.RESULT, id: msg.id, ok: false, error: `未知方法: ${msg.method}` })
      }
      Promise.resolve(handler(msg.payload, msg))
        .then((data) => post({ type: MSG.RESULT, id: msg.id, ok: true, data }))
        .catch((e) => post({ type: MSG.RESULT, id: msg.id, ok: false, error: e?.message || String(e) }))
      break
    }
    case MSG.RPC_RESULT: {
      const p = pending.get(msg.id)
      if (!p) break
      pending.delete(msg.id)
      msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.error))
      break
    }
  }
}

export const bridge = {
  /** 注册宿主命令处理 */
  onInvoke(method, handler) {
    invokeHandlers.set(method, handler)
  },
  /** 发送事件到渲染进程（channel 为完整 flowEventBus:* 通道名） */
  sendEvent(channel, data, nodeId) {
    post({ type: MSG.EVENT, channel, data, nodeId })
  },
  /** 调用主进程 electronAPI（经宿主转发），返回 Promise */
  rpc(method, ...args) {
    const id = ++seq
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      post({ type: MSG.RPC, id, method, args })
    })
  },
  /** 监听引擎内事件（渲染进程 → 节点，如 flowEventBus:nodeEvent:*） */
  on(channel, cb) {
    if (!eventListeners.has(channel)) eventListeners.set(channel, new Set())
    eventListeners.get(channel).add(cb)
    return () => eventListeners.get(channel)?.delete(cb)
  },
  /** 分发引擎内事件（由 engine.js 的 emitNodeEvent 命令触发） */
  emit(channel, data) {
    eventListeners.get(channel)?.forEach((cb) => cb(data))
  }
}
