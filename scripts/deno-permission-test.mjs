/**
 * @file: deno 权限专项测试 — 验证 Worker 最小权限隔离（越权 IO/网络/子进程被拒绝，合法操作放行）
 * 最终状态以 stateChange 事件为准（startFlow 仅触发启动）。
 * @usage: node scripts/deno-permission-test.mjs
 */
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const denoBin = process.env.DENO_BIN || path.join(root, 'resources/deno', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'deno.exe' : 'deno')
const workerRoot = path.resolve(process.env.WORKER_ROOT || path.join(root, 'src/main/workflow/worker'))
const nodesRoot = process.env.WORKER_ROOT ? path.join(workerRoot, 'nodes') : path.join(root, 'src/renderer/src/workflow/nodes')
const nodeModules = process.env.WORKER_ROOT ? path.join(workerRoot, 'node_modules') : path.join(root, 'node_modules')

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'freerpa-perm-'))

// 每个场景一个独立 Worker（权限描述符固定：仅 tmpRoot 可写、仅 example.com 可访问、禁止子进程、env 基础设施白名单、sys 含 umask）
// 与主进程 buildDenoPermissions 对齐（env 非全开、umask 为 node 兼容层写文件硬约束）
const PERMISSIONS = {
  read: [workerRoot, nodesRoot, nodeModules, tmpRoot],
  write: [tmpRoot],
  net: ['example.com'],
  run: [],
  env: ['GRACEFUL_FS_PLATFORM', 'TEST_GRACEFUL_FS_GLOBAL_PATCH', 'READABLE_STREAM', 'BLUEBIRD_DEBUG', 'BLUEBIRD_LONG_STACK_TRACES', 'BLUEBIRD_WARNINGS', 'BLUEBIRD_W_FORGOTTEN_RETURN', 'WS_NO_BUFFER_UTIL', 'WS_NO_UTF_8_VALIDATE', 'NODE_ENV', 'NODE_DEBUG', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP', 'PATH', 'LANG'],
  sys: ['umask']
}

const customNode = (id, code) => ({
  id, type: 'workflowCustomNode', version: 'V1',
  config: { code, params: [], inputs: [] }
})

const buildWorkflow = (flowId, code) => ({
  id: flowId,
  debug: false,
  nodes: [
    { id: 'start', type: 'workflowStart', version: 'V1', config: { params: [], config: [] } },
    customNode('custom', code),
    { id: 'end', type: 'workflowEnd', version: 'V1', config: { params: [] } }
  ],
  edges: [
    { source: 'start', sourceHandle: 'next', target: 'custom', targetHandle: 'prev' },
    { source: 'custom', sourceHandle: 'next', target: 'end', targetHandle: 'prev' }
  ]
})

// ═══════════ 宿主通信 ═══════════
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
  const states = new Map() // flowId → { state, error }
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
      } else if (msg.type === 'event' && msg.channel === `flowEventBus:stateChange:${msg.flowId}`) {
        states.set(msg.flowId, { state: msg.data?.state, error: msg.data?.error })
      }
    }
  })
  const invoke = (method, payload, flowId) => new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    host.stdin.write(JSON.stringify({ type: 'invoke', id, flowId, method, payload }) + '\n')
  })
  return { host, invoke, states }
}

const runFlow = async (hostApi, workflow) => {
  await hostApi.invoke('createWorker', { flowId: workflow.id, permissions: PERMISSIONS })
  await hostApi.invoke('init', { flowId: workflow.id, nodesRoot, ioRoots: [tmpRoot] }, workflow.id)
  await hostApi.invoke('createEngine', { workflow }, workflow.id)
  await hostApi.invoke('startFlow', {}, workflow.id)
  // 等待最终状态（stopped/completed/error）
  for (let i = 0; i < 50; i++) {
    const s = hostApi.states.get(workflow.id)
    if (s && ['stopped', 'completed', 'error'].includes(s.state)) return s
    await new Promise((r) => setTimeout(r, 100))
  }
  return { state: 'timeout', error: '未收到最终状态' }
}

// 场景：越权写（tmpRoot 外）/ 越权网络 / 被禁子进程 / 合法写入 / node:fs 写文件（umask 授予）/ env 越权变量未授权
const evilPath = path.join(os.tmpdir(), 'freerpa-evil.txt')
const okPath = path.join(tmpRoot, 'ok.txt')
const cases = [
  { name: '越权写文件被拒', code: `await Deno.writeTextFile(${JSON.stringify(evilPath)}, 'x')`, expect: 'error' },
  { name: '越权网络被拒', code: `await fetch('https://blocked.invalid/data')`, expect: 'error' },
  { name: '子进程被禁', code: `await new Deno.Command('ls').output()`, expect: 'error' },
  { name: '合法写入放行', code: `await Deno.writeTextFile(${JSON.stringify(okPath)}, 'ok')`, expect: 'stopped' },
  // exceljs 依赖链含 graceful-fs（模块加载期 process.umask()，即 workbookCreate 报错路径）：sys 授予 umask 后应放行
  { name: 'node 库加载放行（umask）', code: `await import('exceljs')`, expect: 'stopped' },
  // env 为基础设施白名单：越权变量不应被授权（querySync 校验，deno 对未授权 env.get 静默返回 undefined，故用权限查询验证）
  { name: 'env 越权变量未授权', code: `const p = Deno.permissions.querySync({ name: 'env', variable: 'SOME_SECRET' }); if (p.state === 'granted') throw new Error('越权变量被授权')`, expect: 'stopped' }
]

let failed = 0
for (let idx = 0; idx < cases.length; idx++) {
  const c = cases[idx]
  const hostApi = createHost()
  const flowId = `perm-${idx}`
  const result = await runFlow(hostApi, buildWorkflow(flowId, c.code))
  try { hostApi.host.stdin.write(JSON.stringify({ type: 'invoke', method: 'shutdown', payload: {} }) + '\n') } catch {}
  setTimeout(() => hostApi.host.kill(), 200)

  const pass = result.state === c.expect
  console.log(`${pass ? '✓' : '✗'} ${c.name}: ${result.state}${result.error ? ' — ' + result.error : ''}`)
  if (!pass) failed++
}

// 越权文件不应存在
if (fs.existsSync(evilPath)) {
  console.log('✗ 越权文件被创建了！')
  failed++
}

fs.rmSync(tmpRoot, { recursive: true, force: true })
if (failed) {
  console.error(`✗ ${failed} 个用例失败`)
  process.exit(1)
}
console.log('✓ 权限测试全部通过')
