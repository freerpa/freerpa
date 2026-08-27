/**
 * @file: 浏览器管理IPC通信处理
 * @author: dabao / FreeRPA
 */

import { ipcMain } from 'electron'
import { launchEnvBrowser } from './launch.js'
import { getAllBrowserStatus, getBrowserInstance, incrementRef, decrementRef } from './manager'

const safeMsg = (e, fallback) => (e && typeof e.message === 'string') ? e.message : fallback

export const register = () => {
  // ========== 打开/关闭浏览器 ==========

  ipcMain.handle('env:openBrowser', async (event, { envId, proxy, fingerprint: existingFingerprint }) => {
    try {
      // 如果已打开则复用（工作流可能已启动同一环境）
      const existing = getBrowserInstance(envId)
      if (existing) {
        return { code: 200, message: '浏览器已打开（复用）', data: { instanceId: existing.instanceId, port: existing.port, wsEndpoint: existing.wsEndpoint } }
      }

      const fingerprint = existingFingerprint?.seed ? existingFingerprint
        : { seed: Math.floor(Math.random() * 2147483647) + 1, platform: { win32: 'windows', darwin: 'macos' }[process.platform] || 'linux' }

      const instance = await launchEnvBrowser({
        envId,
        proxy: proxy || '',
        fingerprintSeed: fingerprint.seed,
        sender: event.sender
      })

      incrementRef(envId)

      if (!existingFingerprint?.seed) {
        try { if (event.sender && !event.sender.isDestroyed()) event.sender.send('env:saveSession', { envId: String(envId), fingerprint }) } catch (_) { }
      }

      return { code: 200, message: '浏览器已打开', data: { instanceId: String(instance.id), port: Number(instance.port), wsEndpoint: String(instance.wsEndpoint) } }
    } catch (e) {
      return { code: 400, message: safeMsg(e, '打开浏览器失败') }
    }
  })

  ipcMain.handle('env:closeBrowser', async (_, { envId }) => {
    try { await decrementRef(envId); return { code: 200, message: '浏览器已关闭' } }
    catch (e) { return { code: 400, message: safeMsg(e, '关闭失败') } }
  })

  // ========== 状态查询 ==========

  ipcMain.handle('env:getAllBrowserStatus', async () => {
    return { code: 200, data: getAllBrowserStatus() }
  })
}