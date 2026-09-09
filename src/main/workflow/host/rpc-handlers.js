/**
 * @file: 引擎 RPC handlers — worker 内 electronAPI 调用的主进程实现
 * （浏览器内核启动、剪贴板、shell、数据模型、异步事件、节点事件注册等需主进程能力的操作）
 */
import { clipboard, shell, app, ipcMain } from 'electron'
import { getBrowserDetail } from '../../api/browserDetail.js'
import { launchEnvBrowser } from '../../browser/launch.js'
import {
  getBrowserInstance, registerBrowser, incrementRef, decrementRef, killBrowserProcess
} from '../../browser/manager'
import { matchTemplate } from '../../browser/selector/imageMatcher.js'
import { sendToRendererAsync } from './rendererUtils.js'
import { getModelData, updateModelData, deleteModelData, batchCreateModelData } from '../../data'
import { dbConnect, dbQuery, dbClose, dbCloseAll } from '../db-manager.js'

// 浏览器内核归属：flowId → Set<envId>（仅允许工作流释放自己打开的环境引用）
const openedBrowsers = new Map()
export const clearFlowBrowsers = (flowId) => openedBrowsers.delete(flowId)

// 同 envId 并发启动去重（进行中的 launchKernel 共享，避免重复启动内核）
const browserOpenPending = new Map()

const trackOpen = (flowId, envId) => {
  if (flowId && envId) {
    if (!openedBrowsers.has(flowId)) openedBrowsers.set(flowId, new Set())
    openedBrowsers.get(flowId).add(envId)
  }
}

// ═══════════ 浏览器：内核启动/复用（页面操作在 worker 内 puppeteer） ═══════════
async function browserOpen(args, host, flowId) {
  const { env, options } = args[0] || {}
  const { headless = false, proxy: optionProxy = '', extraArgs = [] } = options || {}
  const envId = env?.id
  const randomFingerprint = !!env?.random_fingerprint

  // 已打开则复用现有内核（worker 内创建独立 BrowserContext）
  // 随机指纹例外：不复用上次实例，先关闭旧实例再全新启动（保证每次打开都是全新的浏览器）
  if (envId) {
    const existing = getBrowserInstance(envId)
    if (existing) {
      if (randomFingerprint) {
        await killBrowserProcess(envId)
      } else {
        incrementRef(envId)
        trackOpen(flowId, envId)
        return { wsEndpoint: existing.wsEndpoint, instanceId: existing.instanceId, reuse: true }
      }
    }
  }

  let instance
  let reuse = false
  if (envId && browserOpenPending.has(envId)) {
    // 并发去重：同一 envId 的启动进行中 → 等待同一内核；返回 reuse=true 让 worker 走独立 BrowserContext（避免共享默认页竞态）
    instance = await browserOpenPending.get(envId)
    reuse = true
  } else {
    const p = doLaunch(env, options)
    if (envId) browserOpenPending.set(envId, p)
    try {
      instance = await p
    } finally {
      if (envId) browserOpenPending.delete(envId)
    }
  }

  if (envId) {
    incrementRef(envId)
    trackOpen(flowId, envId)
  }
  return { wsEndpoint: instance.wsEndpoint, instanceId: String(instance.id), reuse }
}

// 内核启动 + 注册（browserOpen 内部复用）
async function doLaunch(env, options) {
  const { headless = false, proxy: optionProxy = '', extraArgs = [] } = options || {}
  const proxy = optionProxy || env?.proxy_url || ''
  // 环境配置字段（getBrowserDetail 已展开 config）：随机指纹、窗口尺寸
  const randomFingerprint = !!env?.random_fingerprint
  const width = Number(env?.width) || 1280
  const height = Number(env?.height) || 720

  return launchEnvBrowser({
    envId: env?.id,
    proxy,
    // 随机指纹开启时传 undefined → 由 launchEnvBrowser 每次随机新种子；否则用已保存种子
    fingerprintSeed: randomFingerprint ? undefined : env?.fingerprint?.seed,
    headless,
    timezone: env?.timezone || '',
    width,
    height,
    randomFingerprint,
    lang: 'en-US',
    extraArgs
  })
}

// worker 内关闭页面后释放引用（ref 归零自动杀内核）
// 归属校验：运行中（记录未清理）必须匹配本工作流打开过的 envId；终态后记录已清 → 放行（避免清理竞态导致 ref 泄漏、内核残留）
async function browserRelease(args, host, flowId) {
  const { envId } = args[0] || {}
  if (!envId) return true
  if (flowId && openedBrowsers.has(flowId) && !openedBrowsers.get(flowId).has(envId)) {
    throw new Error(`无权释放浏览器引用: ${envId}`)
  }
  openedBrowsers.get(flowId)?.delete(envId)
  await decrementRef(envId)
  return true
}

// ═══════════ 节点事件通道注册（渲染进程 invoke → 转发 worker） ═══════════
const nodeEventChannels = new Set()

async function registerNodeEvent(args, host, flowId) {
  const [channel] = args
  // 仅允许注册本工作流自己的节点事件通道（防 worker 覆盖其他 IPC handler / 冒用他人通道）
  if (
    typeof channel !== 'string' ||
    !channel.startsWith('flowEventBus:nodeEvent:') ||
    channel.split(':')[2] !== flowId
  ) {
    throw new Error('非法节点事件通道')
  }
  if (nodeEventChannels.has(channel)) return true
  nodeEventChannels.add(channel)
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, async (event, params) => {
    // channel 格式：flowEventBus:nodeEvent:<flowId>:<nodeId>
    const flowId = channel.split(':')[2]
    return await host.invoke('emitNodeEvent', { channel, payload: params }, flowId)
  })
  return true
}

async function unregisterNodeEvent(args, host, flowId) {
  const [channel] = args
  if (
    typeof channel !== 'string' ||
    !channel.startsWith('flowEventBus:nodeEvent:') ||
    channel.split(':')[2] !== flowId
  ) {
    throw new Error('非法节点事件通道')
  }
  nodeEventChannels.delete(channel)
  ipcMain.removeAllListeners(channel)
  ipcMain.removeHandler(channel)
  return true
}

// ═══════════ 异步事件（sendNodeEvent async 模式：渲染进程响应） ═══════════
const sendToRendererAsyncRpc = (args, host, flowId) => {
  const [channel] = args
  // 仅允许向本工作流的 nodeEvent 通道发送（防 worker 伪造其他模块/他人通道事件）
  if (
    typeof channel !== 'string' ||
    !channel.startsWith('flowEventBus:nodeEvent:') ||
    channel.split(':')[2] !== flowId
  ) {
    throw new Error('非法事件通道')
  }
  return sendToRendererAsync(channel, args[1])
}

// ═══════════ RPC 方法表（每个方法签名 (args, host) → Promise） ═══════════
const HANDLERS = {
  getBrowserDetail: (args) => getBrowserDetail(args[0]),
  'browser.open': browserOpen,
  'browser.release': browserRelease,
  'electron.clipboard.readText': () => clipboard.readText(),
  'electron.clipboard.writeText': (args) => clipboard.writeText(args[0]),
  'electron.clipboard.clear': () => clipboard.clear(),
  'electron.shell.openPath': (args) => shell.openPath(args[0]),
  'electron.shell.openExternal': (args) => shell.openExternal(args[0]),
  'electron.shell.showItemInFolder': (args) => shell.showItemInFolder(args[0]),
  'electron.app.getPath': (args) => app.getPath(args[0]),
  'data.getModelData': (args) => getModelData(...args),
  'data.updateModelData': (args) => updateModelData(...args),
  'data.deleteModelData': (args) => deleteModelData(...args),
  'data.batchCreateModelData': (args) => batchCreateModelData(...args),
  // 外部数据库（连接经 RPC 建立于主进程，worker 无网络能力；flowId 归属校验见实现）
  'db.connect': (args, host, flowId) => dbConnect(flowId, args[0] || {}),
  'db.query': (args) => dbQuery(args[0], args[1]),
  'db.close': (args) => dbClose(args[0]),
  'db.closeAll': (args, host, flowId) => dbCloseAll(flowId || args[0]),
  sendToRendererAsync: sendToRendererAsyncRpc,
  matchTemplate: (args) => matchTemplate(args[0], args[1]),
  'engine.registerNodeEvent': registerNodeEvent,
  'engine.unregisterNodeEvent': unregisterNodeEvent
}

/** 执行 worker RPC（msg.args 为参数数组，host 为 EngineHost 实例，flowId 用于资源归属校验） */
export async function handleRpc(msg, host) {
  const handler = HANDLERS[msg.method]
  if (!handler) throw new Error(`未知 RPC 方法: ${msg.method}`)
  return await handler(msg.args || [], host, msg.flowId)
}
