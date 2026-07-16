/**
 * @file: 浏览器管理IPC通信处理
 * @author: dabao / FreeRPA
 */

import { ipcMain, app } from 'electron'
import { checkKernelExists, launchKernel, downloadKernel, fetchKernelList } from './kernel'
import { API_CONFIG } from '@/api/config'
import { registerBrowser, killBrowserProcess, isBrowserOpen, getAllBrowserStatus, getBrowserInstance, incrementRef, decrementRef } from './manager'
import path from 'path'

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
    try { return await (await fetch(`${API_CONFIG.BASE_URL}/kernel/resolveVersion?major_version=${majorVersion}&platform=${platform}`)).json() }
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
      if (!kernel?.platform || !kernel?.version) return { code: 400, message: '内核参数不完整' }
      if (!checkKernelExists(kernel.platform, kernel.version)) return { code: 400, message: 'KERNEL_NEED_DOWNLOAD' }

      const fingerprint = existingFingerprint?.seed ? existingFingerprint
        : { seed: Math.floor(Math.random() * 2147483647) + 1, platform: { win32: 'windows', darwin: 'macos' }[process.platform] || 'linux' }

      const instance = await launchKernel({
        platform: kernel.platform, version: kernel.version,
        proxy: proxy || '', fingerprintSeed: fingerprint.seed,
        userDataDir: path.join(app.getPath('userData'), 'sessions', String(envId)),
        extraArgs: ['--no-restore-session-state', '--disable-session-crashed-bubble'],
      })

      registerBrowser(envId, instance, event.sender)
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

  ipcMain.handle('env:getBrowserStatus', async (_, { envId }) => {
    return { code: 200, data: { isOpen: isBrowserOpen(envId) } }
  })

  ipcMain.handle('env:getAllBrowserStatus', async () => {
    return { code: 200, data: getAllBrowserStatus() }
  })

  // ========== GEO 查询 ==========

  ipcMain.handle('env:queryGeo', async (_, { proxy }) => {
    try {
      const url = proxy ? `${API_CONFIG.BASE_URL}/geo/query?proxy=${encodeURIComponent(proxy)}` : `${API_CONFIG.BASE_URL}/geo/query`
      return await (await fetch(url)).json()
    } catch (e) { return { code: 400, message: safeMsg(e, '查询失败') } }
  })
}
