/**
 * @file: 浏览器管理IPC通信处理
 * @author: dabao / FreeRPA
 */

import { ipcMain } from 'electron'
import { checkKernelExists, downloadKernel, fetchKernelList, resolveKernelVersion } from './kernel'
import { API_CONFIG } from '@/api/config'
import { launchEnvBrowser } from './launch.js'
import { registerBrowser, killBrowserProcess, isBrowserOpen, getAllBrowserStatus, getBrowserInstance, incrementRef, decrementRef } from './manager'

const safeMsg = (e, fallback) => (e && typeof e.message === 'string') ? e.message : fallback

export const register = () => {
  // ========== 内核查询 ==========

  ipcMain.handle('env:getKernelList', async () => {
    try { return { code: 200, data: await fetchKernelList(API_CONFIG.BASE_URL) } }
    catch (e) { return { code: 400, message: safeMsg(e, '获取失败') } }
  })

  ipcMain.handle('env:getMajorVersionList', async () => {
    try { return await (await fetch(`${API_CONFIG.BASE_URL}/kernel/majorList`)).json() }
    catch (e) { return { code: 400, message: safeMsg(e, '获取失败') } }
  })

  ipcMain.handle('env:checkKernel', async (_, { platform, version }) => {
    return { code: 200, data: { exists: checkKernelExists(platform, version) } }
  })

  ipcMain.handle('env:resolveKernelVersion', async (_, { majorVersion, platform }) => {
    try { return { code: 200, data: await resolveKernelVersion(API_CONFIG.BASE_URL, majorVersion, platform) } }
    catch (e) { return { code: 400, message: safeMsg(e, '查询失败') } }
  })

  // ========== 内核下载 ==========

  ipcMain.handle('env:downloadKernel', async (event, kernel) => {
    try {
      await downloadKernel(kernel, (pct, msg) => {
        try { if (event.sender && !event.sender.isDestroyed()) event.sender.send('env:downloadKernelProgress', { percent: Math.round(pct * 100), message: msg }) } catch (_) { }
      })
      return { code: 200, message: '下载完成' }
    } catch (e) {
      return { code: 400, message: safeMsg(e, '下载失败') }
    }
  })

  // ========== 打开/关闭浏览器 ==========

  ipcMain.handle('env:openBrowser', async (event, { envId, kernel, proxy, fingerprint: existingFingerprint }) => {
    try {
      // 如果已打开则复用（工作流可能已启动同一环境）
      if (isBrowserOpen(envId)) {
        const existing = getBrowserInstance(envId)
        if (existing) {
          return { code: 200, message: '浏览器已打开（复用）', data: { instanceId: existing.instanceId, port: existing.port, wsEndpoint: existing.wsEndpoint } }
        }
      }

      const fingerprint = existingFingerprint?.seed ? existingFingerprint
        : { seed: Math.floor(Math.random() * 2147483647) + 1, platform: { win32: 'windows', darwin: 'macos' }[process.platform] || 'linux' }

      const instance = await launchEnvBrowser({
        envId,
        kernel,
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
      if (e?.message === 'KERNEL_NEED_DOWNLOAD') return { code: 400, message: 'KERNEL_NEED_DOWNLOAD' }
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
