/**
 * @file: deno 宿主进程 — 主进程（stdin/stdout JSON 行）与工作流 Worker（postMessage）之间的路由器
 * 权限：Worker 的 deno.permissions 描述符由主进程按权限规则生成（最小权限原则）
 */
import { MSG, encodeLine, LineDecoder } from './protocol.js'

// worker 内部异常/未处理 rejection 不拖垮宿主（仅影响对应工作流）
globalThis.addEventListener('unhandledrejection', (e) => {
  console.error('[host] unhandledrejection:', e.reason?.message || e.reason)
})
globalThis.addEventListener('error', (e) => {
  console.error('[host] error:', e.error?.message || e.message)
})

const workers = new Map() // flowId → Worker

const out = (msg) => {
  Deno.stdout.write(new TextEncoder().encode(encodeLine(msg)))
}

// 主进程 → 宿主：JSON 行
const decoder = new LineDecoder((msg) => handleMain(msg))
for await (const chunk of Deno.stdin.readable) {
  decoder.push(new TextDecoder().decode(chunk))
}

async function handleMain(msg) {
  switch (msg.type) {
    case MSG.INVOKE:
      if (msg.method === 'createWorker') {
        try {
          await createWorker(msg.payload)
          out({ type: MSG.RESULT, id: msg.id, ok: true })
        } catch (e) {
          out({ type: MSG.RESULT, id: msg.id, ok: false, error: e?.message || String(e) })
        }
        return
      }
      if (msg.method === 'shutdown') {
        for (const flowId of workers.keys()) await destroyWorker(flowId)
        Deno.exit(0)
      }
      forward(msg)
      break
    case MSG.RPC_RESULT:
      forward(msg)
      break
  }
}

// 转发消息到对应工作流 Worker
function forward(msg) {
  const entry = workers.get(msg.flowId)
  if (!entry) return
  entry.worker.postMessage(msg)
}

async function createWorker({ flowId, permissions }) {
  if (workers.has(flowId)) await destroyWorker(flowId)
  const worker = new Worker(new URL('./engine.js', import.meta.url), {
    type: 'module',
    deno: { permissions }
  })
  const entry = { worker }
  workers.set(flowId, entry)
  worker.onmessage = (evt) => {
    const m = evt.data
    if (m.type === 'ready') return // 就绪信号不转发
    m.flowId = flowId
    out(m)
    // 终态（completed/stopped/error）后延迟销毁 Worker：先让 RESULT（如 stopFlow 响应）送达主进程；
    // 销毁前校验身份，防止误杀期间同 flowId 重建的新 Worker
    if (
      m.type === MSG.EVENT &&
      m.channel === `flowEventBus:stateChange:${flowId}` &&
      ['completed', 'stopped', 'error'].includes(m.data?.state)
    ) {
      setTimeout(() => {
        if (workers.get(flowId) === entry) destroyWorker(flowId)
      }, 1000)
    }
  }
  worker.addEventListener('error', (e) => {
    e.preventDefault?.() // 阻止宿主进程因 worker 异常崩溃
    out({
      type: MSG.EVENT,
      flowId,
      channel: `flowEventBus:stateChange:${flowId}`,
      data: { state: 'error', error: e?.message || 'worker 异常退出' }
    })
    destroyWorker(flowId)
  })
}

async function destroyWorker(flowId) {
  const entry = workers.get(flowId)
  if (!entry) return
  workers.delete(flowId)
  try {
    entry.worker.terminate()
  } catch {
    /* 已退出 */
  }
}
