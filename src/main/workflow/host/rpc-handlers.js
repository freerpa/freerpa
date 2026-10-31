/**
 * @file: 引擎 RPC handlers — worker 内 electronAPI 调用的主进程实现
 * （浏览器内核启动、剪贴板、shell、数据模型、异步事件、节点事件注册等需主进程能力的操作）
 */
import { clipboard, shell, app, ipcMain } from 'electron'
import { getBrowserDetail } from '../../api/browserDetail.js'
import { launchEnvBrowser } from '../../browser/launch.js'
import {
  getBrowserInstance, incrementRef, decrementRef, killBrowserProcess
} from '../../browser/manager'
import { matchTemplate } from '../../browser/selector/imageMatcher.js'
import { sendToRendererAsync } from './rendererUtils.js'
import { getModelData, updateModelData, deleteModelData, batchCreateModelData } from '../../data'
import { dbConnect, dbQuery, dbClose, dbCloseAll } from '../db-manager.js'

// 浏览器内核归属：flowId → Set<envId>（仅允许工作流释放自己打开的环境引用）
const openedBrowsers = new Map()

// 批量执行实例（isolated）：同一浏览器环境共用同一内核、共享数据目录与登录态，不复制内核
const isolatedFlows = new Set()
export const markIsolatedFlow = (flowId) => {
  if (flowId) isolatedFlows.add(flowId)
}
export const isIsolatedFlow = (flowId) => isolatedFlows.has(flowId)

/**
 * 清理指定 flow 的浏览器归属记录，并兜底释放其中仍未释放的内核引用。
 * - 正常终态：节点销毁钩子已在终态上报前 await browser.release，集合已空（无副作用）。
 * - worker 被强制销毁（批量实例停止/删除）或 worker 异常：来不及 browser.release，此处兜底释放，避免内核与引用计数泄漏。
 * - 释放后的 envId 从集合移除 → 迟到/重复的 browser.release 成为幂等空操作（见 browserRelease）。
 * - 清理即取消 isolated 登记（该实例生命周期已结束，重跑会以新实例 id 重新登记）。
 */
export const clearFlowBrowsers = (flowId) => {
  isolatedFlows.delete(flowId)
  const envIds = openedBrowsers.get(flowId)
  if (!envIds) return
  openedBrowsers.delete(flowId)
  for (const envId of envIds) decrementRef(envId).catch(() => {})
}

// 同 envId 并发启动去重（进行中的 launchKernel 共享，避免重复启动内核）
const browserOpenPending = new Map()

const trackOpen = (flowId, envId) => {
  if (flowId && envId) {
    if (!openedBrowsers.has(flowId)) openedBrowsers.set(flowId, new Set())
    openedBrowsers.get(flowId).add(envId)
  }
}

/** 该 envId 是否仍被其他工作流/实例持有（其他 flowId 的归属记录里存在） */
const isEnvHeldByOthers = (flowId, envId) => {
  for (const [fid, envIds] of openedBrowsers) {
    if (fid !== flowId && envIds.has(envId)) return true
  }
  return false
}

// ═══════════ 浏览器：内核启动/复用（页面操作在 worker 内 puppeteer） ═══════════
async function browserOpen(args, host, flowId) {
  const { env, options } = args[0] || {}
  const envId = env?.id
  const randomFingerprint = !!env?.random_fingerprint

  // 已打开则复用现有内核（worker 内创建独立 BrowserContext / 独立窗口）
  // 随机指纹例外：编辑器单次执行（非 isolated）时每次全新 → 先关闭旧实例再启动；
  // 批量实例（isolated）同一环境共用同一内核，绝不 kill（否则 N 个实例互相关闭内核）
  const isolated = isIsolatedFlow(flowId)
  if (envId) {
    const existing = getBrowserInstance(envId)
    if (existing) {
      // 仍有其他工作流/实例在用同一内核时不 kill（否则会把别人的浏览器一起关掉）
      if (randomFingerprint && !isolated && !isEnvHeldByOthers(flowId, envId)) {
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
// 归属校验：必须匹配本工作流打开过的 envId；
// 归属记录已被 clearFlowBrowsers 清理（该实例已结束、引用已兜底释放）→ 幂等空操作，避免重复 decrement 提前关闭他人仍在使用的内核
async function browserRelease(args, host, flowId) {
  const { envId } = args[0] || {}
  if (!envId) return true
  const envIds = openedBrowsers.get(flowId)
  if (!envIds) return true
  if (!envIds.has(envId)) throw new Error(`无权释放浏览器引用: ${envId}`)
  envIds.delete(envId)
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
