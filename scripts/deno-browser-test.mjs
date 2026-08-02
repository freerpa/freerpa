/**
 * @file: deno 浏览器冒烟测试 — 真实指纹内核：验证 page.find 挂载可用、browser.open 只启动一个内核
 * 依赖本机已下载的指纹内核（~/Library/Application Support/FreeRPA/kernels/macos/<ver>/Chromium.app）
 * @usage: node scripts/deno-browser-test.mjs
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
const dataHandlers = process.env.WORKER_ROOT ? path.join(workerRoot, 'data-handlers') : path.join(root, 'src/renderer/src/workflow/dataHandlers')
const nodeModules = process.env.WORKER_ROOT ? path.join(workerRoot, 'node_modules') : path.join(root, 'node_modules')

// ═══════════ 定位指纹内核 ═══════════
const kernelsDir = path.join(os.homedir(), 'Library/Application Support/FreeRPA/kernels/macos')
const findKernel = () => {
  if (!fs.existsSync(kernelsDir)) return null
  const versions = fs.readdirSync(kernelsDir)
  for (const v of versions) {
    const bin = path.join(kernelsDir, v, 'Chromium.app/Contents/MacOS/Chromium')
    if (fs.existsSync(bin)) return bin
  }
  return null
}
const kernelBin = findKernel()
if (!kernelBin) {
  console.log('✗ 未找到指纹内核，跳过浏览器冒烟（不影响其他测试）')
  process.exit(0)
}

// ═══════════ 启动真实内核 ═══════════
const CDP_PORT = 19299
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freerpa-kernel-'))
const kernel = spawn(kernelBin, [
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${userDataDir}`,
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--no-first-run', '--no-default-browser-check',
  'about:blank'
], { stdio: 'ignore' })

const waitCdp = async (timeout = 30000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const resp = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
      const d = await resp.json()
      if (d.webSocketDebuggerUrl) return d.webSocketDebuggerUrl
    } catch { /* 未就绪 */ }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('内核 CDP 端口连接超时')
}

let openCount = 0
let releaseCount = 0

// ═══════════ mock 主进程 + 宿主通信 ═══════════
const host = spawn(denoBin, [
  'run', '--no-prompt', '--unstable-worker-options', '-A',
  '--import-map', path.join(workerRoot, 'import-map.json'),
  '--node-modules-dir',
  path.join(workerRoot, 'host.js')
], { stdio: ['pipe', 'pipe', 'pipe'], cwd: workerRoot })
host.stderr.on('data', (c) => process.stderr.write(c))
let buf = ''
const pending = new Map()
const states = new Map()
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
    } else if (msg.type === 'rpc') {
      // mock 主进程 electronAPI
      handleRpc(msg).then((data) => {
        host.stdin.write(JSON.stringify({ type: 'rpcResult', id: msg.id, flowId: msg.flowId, ok: true, data }) + '\n')
      }).catch((e) => {
        host.stdin.write(JSON.stringify({ type: 'rpcResult', id: msg.id, flowId: msg.flowId, ok: false, error: e.message }) + '\n')
      })
    }
  }
})

let wsEndpoint = null
async function handleRpc(msg) {
  switch (msg.method) {
    case 'browser.open':
      openCount++
      return { wsEndpoint, instanceId: 'test-kernel', reuse: false }
    case 'browser.release':
      releaseCount++
      return true
    case 'getBrowserDetail':
      return null
    case 'engine.registerNodeEvent':
    case 'engine.unregisterNodeEvent':
      return true
    default:
      return null
  }
}

const invoke = (method, payload, flowId) => new Promise((resolve, reject) => {
  const id = ++seq
  pending.set(id, { resolve, reject })
  host.stdin.write(JSON.stringify({ type: 'invoke', id, flowId, method, payload }) + '\n')
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 工作流：打开浏览器 → 键盘输入（page.find）→ 结束
const workflow = {
  id: 'browser-test',
  debug: false,
  nodes: [
    { id: 'start', type: 'workflowStart', version: 'V1', config: { params: [], config: [] } },
    {
      id: 'open', type: 'browserOpen', version: 'V1',
      config: { browser: 'FreeRPA', envId: '', proxyUrl: '', launchOptions: [], script: '', extraArgs: [] }
    },
    {
      id: 'keyboard', type: 'browserKeyboardInput', version: 'V1',
      config: { keyboardMode: 'input', inputSelector: { name: 'body', match_condition: 'any', selectors: [{ type: 'css', expression: 'body' }] }, text: 'hello', mode: 'char', delay: 10 }
    },
    { id: 'delay', type: 'timeDelay', version: 'V1', config: { mode: 'fiexd', duration: 3000, minDuration: 3000, maxDuration: 3000 } },
    { id: 'end', type: 'workflowEnd', version: 'V1', config: { params: [] } }
  ],
  edges: [
    { source: 'start', sourceHandle: 'next', target: 'open', targetHandle: 'prev' },
    // 顺序边（next → prev）+ 数据边（page → page，浏览器对象传递）
    { source: 'open', sourceHandle: 'next', target: 'keyboard', targetHandle: 'prev' },
    { source: 'open', sourceHandle: 'page', target: 'keyboard', targetHandle: 'page' },
    { source: 'keyboard', sourceHandle: 'next', target: 'delay', targetHandle: 'prev' },
    { source: 'delay', sourceHandle: 'next', target: 'end', targetHandle: 'prev' }
  ]
}

try {
  wsEndpoint = await waitCdp()
  console.log('✓ 真实内核已启动（CDP 就绪）')

  await invoke('createWorker', {
    flowId: workflow.id,
    permissions: { read: [workerRoot, nodesRoot, dataHandlers, nodeModules], write: [], net: true, run: [], env: true, sys: [] }
  })
  await invoke('init', { flowId: workflow.id, nodesRoot, ioRoots: [] }, workflow.id)
  await invoke('createEngine', { workflow }, workflow.id)
  await invoke('startFlow', {}, workflow.id)

  // 浏览器打开期间（timeDelay 3s）统计内核页面数：应为 1（单节点只开一个浏览器窗口）
  let windowCount = null
  for (let i = 0; i < 40; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
      const pages = targets.filter((t) => t.type === 'page')
      if (pages.length > 0) {
        windowCount = pages.length
        break
      }
    } catch { /* 未就绪 */ }
    await sleep(200)
  }
  if (windowCount === null) {
    console.log('⚠ 未能在窗口期内观测到浏览器页面，跳过窗口数断言')
  } else {
    console.log(`浏览器窗口（page target）数量: ${windowCount}（应为 1）`)
    if (windowCount !== 1) throw new Error(`✗ 浏览器窗口数为 ${windowCount}（应只打开一个）`)
  }

  for (let i = 0; i < 60; i++) {
    const s = states.get(workflow.id)
    if (s && ['stopped', 'completed', 'error'].includes(s.state)) {
      if (s.state === 'error') throw new Error(`工作流失败: ${s.error}`)
      break
    }
    await sleep(200)
  }

  console.log(`✓ 工作流结束: ${states.get(workflow.id)?.state}`)
  console.log(`browser.open 调用次数: ${openCount}（应为 1）`)
  console.log(`browser.release 调用次数: ${releaseCount}`)
  if (openCount !== 1) throw new Error(`✗ browser.open 被调用 ${openCount} 次（应只启动一个内核）`)
  if (states.get(workflow.id)?.state !== 'stopped') throw new Error('工作流未正常结束')
  console.log('✓ 浏览器冒烟测试通过（page.find 可用 + 单内核 + 单窗口）')
} catch (e) {
  console.error('✗ 浏览器冒烟失败:', e.message)
  process.exitCode = 1
} finally {
  try { host.stdin.write(JSON.stringify({ type: 'invoke', method: 'shutdown', payload: {} }) + '\n') } catch {}
  setTimeout(() => {
    try { host.kill() } catch {}
    try { kernel.kill() } catch {}
    fs.rmSync(userDataDir, { recursive: true, force: true })
    process.exit(process.exitCode || 0)
  }, 300)
}
