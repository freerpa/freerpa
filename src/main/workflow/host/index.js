/**
 * @file: 引擎宿主（主进程侧）— 管理 deno 宿主进程生命周期、RPC 调用、事件路由
 *  - spawn/守护 deno host.js（JSON 行协议，stdin/stdout）
 *  - invoke：向宿主（或指定工作流 Worker）发起命令
 *  - event：worker 事件 → 转发渲染进程；rpc：worker 的 electronAPI 调用 → 主进程实现
 */
import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import path from 'path'
import { encodeLine, LineDecoder } from '../worker/protocol.js'
import { sendToRenderer } from './rendererUtils.js'
import { handleRpc, clearFlowBrowsers } from './rpc-handlers.js'
import { dbCloseAll } from '../db-manager.js'
import { resolveWorkflowPaths } from '../paths.js'

class EngineHost extends EventEmitter {
  #proc = null
  #pending = new Map()
  #seq = 0

  constructor() {
    super()
    this.paths = resolveWorkflowPaths()
    this.runningFlows = new Set() // 运行中的工作流 flowId（用于并发上限与状态跟踪）
  }

  /** 确保宿主进程已启动（退出后自动重启） */
  async ensure() {
    if (this.#proc && this.#proc.exitCode === null) return
    await this.#spawn()
  }

  #spawn() {
    const { denoBin, workerRoot } = this.paths
    const args = [
      'run',
      '-A', // 宿主为可信守护（自身不执行用户代码）；实际权限隔离由各 Worker 的 deno.permissions 描述符实现（最小权限）
      '--no-prompt',
      '--unstable-worker-options', // Worker 级权限描述符（deno.permissions）
      '--import-map',
      path.join(workerRoot, 'import-map.json'),
      '--node-modules-dir=manual', // manual：直接复用现有本地 node_modules 解析裸 npm 包（插件依赖如 js-md5），不写 .deno 管理目录
      path.join(workerRoot, 'host.js')
    ]
    console.log('[engine] 启动 deno 宿主:', denoBin)
    this.#proc = spawn(denoBin, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: workerRoot })

    const decoder = new LineDecoder((msg) => this.#onMsg(msg))
    this.#proc.stdout.on('data', (chunk) => decoder.push(chunk.toString()))
    this.#proc.stderr.on('data', (chunk) => console.error('[engine]', chunk.toString().trim()))
    this.#proc.on('error', (err) => console.error('[engine] 进程错误:', err.message))
    this.#proc.on('exit', (code) => {
      console.log('[engine] 宿主进程退出:', code)
      this.#proc = null
      this.#pending.forEach((p) => p.reject(new Error('引擎宿主进程已退出')))
      this.#pending.clear()
      this.emit('exit', code)
    })
  }

  #write(msg) {
    if (this.#proc) this.#proc.stdin.write(encodeLine(msg))
  }

  #onMsg(msg) {
    switch (msg.type) {
      case 'result': {
        const p = this.#pending.get(msg.id)
        if (!p) break
        this.#pending.delete(msg.id)
        msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.error))
        break
      }
      case 'event': {
        // 仅转发本工作流自己的 flowEventBus:* 事件（防 worker 伪造其他工作流/模块事件）
        const parts = String(msg.channel || '').split(':')
        if (!msg.channel?.startsWith('flowEventBus:') || parts[2] !== msg.flowId) break
        // 工作流/节点状态事件 → 渲染进程（通道名即 flowEventBus:*）
        this.#trackFlow(msg)
        if (msg.flowId && ['completed', 'stopped', 'error'].includes(msg.data?.state)) {
          clearFlowBrowsers(msg.flowId) // 清理浏览器归属记录
          dbCloseAll(msg.flowId).catch(() => {}) // 关闭该工作流打开的外部数据库连接
        }
        sendToRenderer(msg.channel, msg.data)
        break
      }
      case 'rpc': {
        // worker 的 electronAPI 调用 → 主进程实现 → 回传 rpcResult
        handleRpc(msg, this)
          .then((data) => this.#write({ type: 'rpcResult', id: msg.id, flowId: msg.flowId, ok: true, data }))
          .catch((e) => this.#write({ type: 'rpcResult', id: msg.id, flowId: msg.flowId, ok: false, error: e?.message || String(e) }))
        break
      }
    }
  }

  // 根据 stateChange 事件维护运行集合
  #trackFlow(msg) {
    if (msg.channel !== `flowEventBus:stateChange:${msg.flowId}`) return
    const state = msg.data?.state
    if (state === 'running') this.runningFlows.add(msg.flowId)
    else if (['completed', 'stopped', 'error'].includes(state)) this.runningFlows.delete(msg.flowId)
  }

  /** 向宿主/指定工作流 Worker 发起命令 */
  invoke(method, payload = {}, flowId) {
    return new Promise((resolve, reject) => {
      // ensure 失败或写入抛错时 reject，无需 async executor / try/catch 包装
      this.ensure().then(
        () => {
          const id = ++this.#seq
          this.#pending.set(id, { resolve, reject })
          this.#write({ type: 'invoke', id, flowId, method, payload })
        },
        (e) => reject(e)
      )
    })
  }

  /** 创建（或重置）一个工作流 Worker */
  async createWorker(flowId, permissions) {
    return this.invoke('createWorker', { flowId, permissions })
  }

  /** 关闭宿主进程（应用退出） */
  async shutdown() {
    try {
      if (this.#proc) this.#write({ type: 'invoke', method: 'shutdown', payload: {} })
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch { /* 忽略 */ }
    try { this.#proc?.kill() } catch { /* 忽略 */ }
  }
}

export default new EngineHost()
