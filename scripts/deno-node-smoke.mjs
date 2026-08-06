/**
 * @file: 节点冒烟测试 — 覆盖曾完全不可用的节点（preview×3 / networkHttpServer）
 * @usage: node scripts/deno-node-smoke.mjs
 * 说明：dataClipboard 依赖 Electron 主进程 clipboard RPC，无法在宿主级 smoke 覆盖（见 rpc-handlers.js）
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const denoBin = process.env.DENO_BIN || path.join(root, 'resources/deno', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'deno.exe' : 'deno')
const workerRoot = path.resolve(process.env.WORKER_ROOT || path.join(root, 'src/main/workflow/worker'))
const nodesRoot = path.join(root, 'src/renderer/src/workflow/nodes')
const nodeModules = path.join(root, 'node_modules')

// net: true 允许 HTTP server 监听 127.0.0.1（默认权限 allow-all 等价）
const PERMISSIONS = { read: [workerRoot, nodesRoot, nodeModules], write: [], net: true, run: [], env: true, sys: [] }

const scenarios = [
  {
    id: 'preview-fix',
    nodes: [
      { id: 'start', type: 'workflowStart', version: 'V1', config: { params: [], config: [] } },
      { id: 'img', type: 'previewImage', version: 'V1', config: {} },
      { id: 'aud', type: 'previewAudio', version: 'V1', config: {} },
      { id: 'vid', type: 'previewVideo', version: 'V1', config: {} },
      { id: 'end', type: 'workflowEnd', version: 'V1', config: { params: [] } }
    ]
  },
  {
    id: 'httpserver-fix',
    nodes: [
      { id: 'start', type: 'workflowStart', version: 'V1', config: { params: [], config: [] } },
      { id: 'srv', type: 'networkHttpServer', version: 'V1', config: { route: '/hello' } },
      { id: 'end', type: 'workflowEnd', version: 'V1', config: { params: [] } }
    ]
  }
]

const buildEdges = (nodes) => {
  const edges = []
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ source: nodes[i].id, sourceHandle: 'next', target: nodes[i + 1].id, targetHandle: 'prev' })
  }
  return edges
}

function createHost() {
  const host = spawn(denoBin, [
    'run', '--no-prompt', '--unstable-worker-options', '-A',
    '--import-map', path.join(workerRoot, 'import-map.json'),
    '--node-modules-dir',
    path.join(workerRoot, 'host.js')
  ], { stdio: ['pipe', 'pipe', 'pipe'], cwd: root })
  host.stderr.on('data', () => {})
  let buf = ''
  const pending = new Map()
  const states = []
  const nodeErrors = []
  let seq = 0
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
        if (msg.channel.startsWith('flowEventBus:stateChange:')) states.push(msg.data?.state)
        else if (msg.channel.startsWith('flowEventBus:nodeStatus:')) {
          if (msg.data?.state === 'error') nodeErrors.push(`${msg.channel}: ${msg.data?.error}`)
        }
      }
    }
  })
  const invoke = (method, payload, flowId) => new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    host.stdin.write(JSON.stringify({ type: 'invoke', id, flowId, method, payload }) + '\n')
  })
  return { host, invoke, states, nodeErrors }
}

const runFlow = async (hostApi, wf) => {
  await hostApi.invoke('createWorker', { flowId: wf.id, permissions: PERMISSIONS })
  await hostApi.invoke('init', { flowId: wf.id, nodesRoot, ioRoots: [], pluginRoots: [] }, wf.id)
  await hostApi.invoke('createEngine', { workflow: wf }, wf.id)
  await hostApi.invoke('startFlow', {}, wf.id)
  for (let i = 0; i < 60; i++) {
    const s = hostApi.states[hostApi.states.length - 1]
    if (s && ['stopped', 'completed', 'error'].includes(s)) return s
    await new Promise((r) => setTimeout(r, 50))
  }
  return 'timeout'
}

let failed = 0
for (const s of scenarios) {
  const wf = { id: s.id, debug: false, nodes: s.nodes, edges: buildEdges(s.nodes) }
  const hostApi = createHost()
  const final = await runFlow(hostApi, wf)
  try { hostApi.host.stdin.write(JSON.stringify({ type: 'invoke', method: 'shutdown', payload: {} }) + '\n') } catch {}
  setTimeout(() => hostApi.host.kill(), 200)
  const pass = final === 'stopped' && hostApi.nodeErrors.length === 0
  console.log(`${pass ? '✓' : '✗'} ${s.id}: 终态 ${final}${hostApi.nodeErrors.length ? '，错误: ' + hostApi.nodeErrors.join('; ') : ''}`)
  if (!pass) failed++
}

if (failed) { console.error(`✗ ${failed} 个场景失败`); process.exit(1) }
console.log('✓ 节点冒烟测试全部通过')
