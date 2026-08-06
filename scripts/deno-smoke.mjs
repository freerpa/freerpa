/**
 * @file: deno 引擎 smoke 测试 — 模拟主进程协议，验证 宿主 → Worker → 引擎 → 节点 全链路
 * @usage: node scripts/deno-smoke.mjs
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const denoBin = process.env.DENO_BIN || path.join(root, 'resources/deno', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'deno.exe' : 'deno')
// WORKER_ROOT 指向生产布局（resources/worker）时验证生产产物；默认 dev 布局（源码）
const workerRoot = path.resolve(process.env.WORKER_ROOT || path.join(root, 'src/main/workflow/worker'))
const nodesRoot = process.env.WORKER_ROOT ? path.join(workerRoot, 'nodes') : path.join(root, 'src/renderer/src/workflow/nodes')
const nodeModules = process.env.WORKER_ROOT ? path.join(workerRoot, 'node_modules') : path.join(root, 'node_modules')

const args = [
  'run', '--no-prompt', '--unstable-worker-options', '-A',
  '--import-map', path.join(workerRoot, 'import-map.json'),
  '--node-modules-dir',
  path.join(workerRoot, 'host.js')
]

const host = spawn(denoBin, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: root })
host.stderr.on('data', (c) => console.error('[deno]', c.toString().trim()))
host.on('exit', (code) => { console.log('宿主退出:', code); process.exit(code || 0) })

let buf = ''
const pending = new Map()
let seq = 0
const events = []

host.stdout.on('data', (c) => {
  buf += c.toString()
  let i
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i)
    buf = buf.slice(i + 1)
    if (!line.trim()) continue
    const msg = JSON.parse(line)
    if (msg.type === 'result') {
      const p = pending.get(msg.id)
      if (p) { pending.delete(msg.id); msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.error)) }
    } else if (msg.type === 'event') {
      events.push(msg)
      console.log(`[event] ${msg.channel}`, JSON.stringify(msg.data))
    } else {
      console.log('[msg]', msg.type, msg.method)
    }
  }
})

const invoke = (method, payload, flowId) => new Promise((resolve, reject) => {
  const id = ++seq
  pending.set(id, { resolve, reject })
  host.stdin.write(JSON.stringify({ type: 'invoke', id, flowId, method, payload }) + '\n')
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 最小工作流：start → end
const workflow = {
  id: 'smoke-test',
  debug: false,
  nodes: [
    { id: 'start', type: 'workflowStart', version: 'V1', config: { params: [], config: [] } },
    { id: 'end', type: 'workflowEnd', version: 'V1', config: { params: [] } }
  ],
  edges: [{ source: 'start', sourceHandle: 'next', target: 'end', targetHandle: 'prev' }]
}

try {
  // 1. 创建 Worker（宽松权限跑通链路；权限专项测试见 worker-permission 测试）
  await invoke('createWorker', {
    flowId: workflow.id,
    permissions: {
      read: [workerRoot, nodesRoot, nodeModules],
      write: [],
      net: [],
      run: [],
      env: true,
      sys: []
    }
  })
  console.log('✓ createWorker')
  await invoke('init', { flowId: workflow.id, nodesRoot, ioRoots: [] }, workflow.id)
  console.log('✓ init')
  await invoke('createEngine', { workflow }, workflow.id)
  console.log('✓ createEngine')

  // 渲染进程 → 节点事件（emitNodeEvent 双向路由：宿主 → worker bridge.emit）
  const emitResult = await invoke('emitNodeEvent', {
    channel: 'flowEventBus:nodeEvent:smoke-test:start',
    payload: { hello: 'world' }
  }, workflow.id)
  if (emitResult !== null && emitResult !== undefined) throw new Error('emitNodeEvent 应返回 null')
  console.log('✓ emitNodeEvent 双向路由')

  await invoke('startFlow', {}, workflow.id)
  console.log('✓ startFlow')

  // 等待 stateChange stopped/completed
  for (let i = 0; i < 50; i++) {
    if (events.some((e) => e.channel === 'flowEventBus:stateChange:smoke-test' && ['stopped', 'completed', 'error'].includes(e.data?.state))) break
    await sleep(100)
  }
  const final = events.filter((e) => e.channel === 'flowEventBus:stateChange:smoke-test').pop()
  console.log('最终状态:', final?.data?.state)
  if (!final || !['stopped', 'completed'].includes(final.data.state)) {
    console.error('✗ 工作流未正常结束')
    process.exit(1)
  }
  console.log('✓ smoke 测试通过')
  await invoke('shutdown', {})
} catch (e) {
  console.error('✗ smoke 失败:', e.message)
  process.exit(1)
}
