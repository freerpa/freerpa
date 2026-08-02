/**
 * @file: 引擎消息协议（deno 侧：宿主 host.js ↔ 主进程 stdin/stdout、宿主 ↔ 工作流 Worker postMessage）
 *
 * 统一消息结构（JSON）：
 *   invoke   请求执行：{ type, id, flowId?, method, payload }
 *   result   invoke 响应：{ type, id, flowId?, ok, data?, error? }
 *   event    单向事件：{ type, flowId, channel, nodeId?, data }
 *   rpc      worker → 主进程 electronAPI 调用：{ type, id, flowId, method, args }
 *   rpcResult rpc 响应：{ type, id, flowId, ok, data?, error? }
 */
export const MSG = {
  INVOKE: 'invoke',
  RESULT: 'result',
  EVENT: 'event',
  RPC: 'rpc',
  RPC_RESULT: 'rpcResult'
}

// 主进程 ↔ 宿主：JSON 行编码
export const encodeLine = (msg) => JSON.stringify(msg) + '\n'

// 流式 JSON 行解码（deno stdin / 子进程 stdout 通用）
export class LineDecoder {
  #buffer = ''
  constructor(onLine) {
    this.onLine = onLine
  }
  push(chunk) {
    this.#buffer += chunk
    let idx
    while ((idx = this.#buffer.indexOf('\n')) !== -1) {
      const line = this.#buffer.slice(0, idx)
      this.#buffer = this.#buffer.slice(idx + 1)
      if (!line.trim()) continue
      try {
        this.onLine(JSON.parse(line))
      } catch {
        /* 忽略坏行 */
      }
    }
  }
}
