/**
 * @file: 浏览器实例管理
 * @author: FreeRPA
 *
 * 管理通过 env:openBrowser 打开的 fingerprint-chromium 进程
 * 负责实例跟踪、关闭、应用退出清理
 */

import { execSync } from 'child_process'
import { app } from 'electron'

// 存储所有打开的浏览器实例
const openBrowserInstances = new Map()

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
  const entry = { instanceId: String(instance.id), process: instance.process, senderRef }
  openBrowserInstances.set(envId, entry)

  entry.process.on('exit', () => {
    if (openBrowserInstances.delete(envId)) {
      safeSend(entry.senderRef, 'env:browserClosed', { envId: String(envId) })
    }
  })

  safeSend(senderRef, 'env:browserOpened', { envId: String(envId) })
  return entry
}

/**
 * 检查浏览器是否已打开
 */
export const isBrowserOpen = (envId) => openBrowserInstances.has(envId)

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
