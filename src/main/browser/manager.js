/**
 * @file: 浏览器实例管理
 * @author: FreeRPA
 *
 * 管理通过 env:openBrowser 打开的 fingerprint-chromium 进程
 * 负责实例跟踪、关闭、应用退出清理
 */

import { execSync } from 'child_process'
import { app } from 'electron'
import puppeteer from './puppeteer.js'

// 存储所有打开的浏览器实例
const openBrowserInstances = new Map()
// 引用计数：追踪每个环境有多少使用者在连接
const refCounts = new Map()

/**
 * 安全发送 IPC 消息到渲染进程
 */
const safeSend = (sender, channel, data) => {
  try { if (sender && !sender.isDestroyed()) sender.send(channel, data) } catch (_) {}
}

/**
 * 关闭指定浏览器的浏览器进程
 */
export const killBrowserProcess = async (envId) => {
  const entry = openBrowserInstances.get(envId)
  if (!entry) return
  const { process: proc, senderRef } = entry
  openBrowserInstances.delete(envId)

  safeSend(senderRef, 'env:browserClosed', { envId: String(envId) })

  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: 'ignore' })
    } else {
      proc.kill('SIGTERM')
      await new Promise(resolve => {
        const t = setTimeout(() => { try { proc.kill('SIGKILL') } catch (_) {}; resolve() }, 3000)
        proc.on('exit', () => { clearTimeout(t); resolve() })
      })
    }
  } catch (_) {}
}

/**
 * 注册一个打开的浏览器实例
 */
export const registerBrowser = (envId, instance, senderRef) => {
  // 不覆盖已有条目（可能被工作流先注册了）
  if (openBrowserInstances.has(envId)) {
    // 更新 senderRef 为空时保留已有
    if (senderRef && !openBrowserInstances.get(envId).senderRef) {
      openBrowserInstances.get(envId).senderRef = senderRef
    }
    return openBrowserInstances.get(envId)
  }
  const entry = {
    instanceId: String(instance.id),
    process: instance.process,
    port: instance.port,
    wsEndpoint: instance.wsEndpoint,
    senderRef
  }
  openBrowserInstances.set(envId, entry)

  entry.process.on('exit', () => {
    if (openBrowserInstances.delete(envId)) {
      safeSend(entry.senderRef, 'env:browserClosed', { envId: String(envId) })
    }
  })

  // 监控页面数，所有页面关闭时自动退出进程
  startPageMonitor(envId, entry)

  safeSend(senderRef, 'env:browserOpened', { envId: String(envId) })
  return entry
}

/**
 * 后台监控：当浏览器所有页面关闭时自动杀进程
 */
const startPageMonitor = async (envId, entry) => {
  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: entry.wsEndpoint, defaultViewport: null })
    const check = async () => {
      try {
        const pages = await browser.pages()
        if (pages.length === 0) {
          await killBrowserProcess(envId)
          return
        }
        setTimeout(check, 2000)
      } catch (_) {
        // CDP 已断开，进程应该已退出
        killBrowserProcess(envId).catch(() => {})
      }
    }
    setTimeout(check, 3000)
  } catch (_) {}
}

/**
 * 检查浏览器是否已打开
 */
export const isBrowserOpen = (envId) => openBrowserInstances.has(envId)

/**
 * 获取已打开浏览器实例（用于复用连接）
 */
export const getBrowserInstance = (envId) => openBrowserInstances.get(envId) || null

/**
 * 增加引用计数（新使用者接入时调用）
 */
export const incrementRef = (envId) => {
  refCounts.set(envId, (refCounts.get(envId) || 0) + 1)
}

/**
 * 减少引用计数，归零时自动关闭进程
 */
export const decrementRef = async (envId) => {
  const count = (refCounts.get(envId) || 1) - 1
  if (count <= 0) {
    refCounts.delete(envId)
    await killBrowserProcess(envId)
  } else {
    refCounts.set(envId, count)
  }
}

/**
 * 获取所有已打开浏览器状态
 */
export const getAllBrowserStatus = () => {
  const status = {}
  for (const [envId] of openBrowserInstances) status[envId] = true
  return status
}

/**
 * 关闭所有打开的浏览器（应用退出时调用）
 */
export const closeAllBrowsers = async () => {
  for (const envId of [...openBrowserInstances.keys()]) {
    await killBrowserProcess(envId).catch(() => {})
  }
}
