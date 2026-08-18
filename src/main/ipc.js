import { ipcMain, screen, dialog, shell, app, Notification } from 'electron'
import { sendToRenderer } from './workflow/host/rendererUtils'
import { manager as workflowManager } from './workflow/index'
import { get, flush as flushStore } from './store/index'
import { destroyTray } from './app/tray'
import fs from 'fs'
import path from 'path'
import pkg from '../../package.json'
import { API_CONFIG } from './api/config'
export const register = () => {
  // 窗口控制
  ipcMain.on('window-min', () => global.mainWindow.minimize())
  // 隐藏到后台（关闭按钮/系统关闭：后台运行不退出）
  ipcMain.on('window-hide', () => {
    global.mainWindow.hide()
  })
  ipcMain.on('window-max', (event, forceMax = false) => {
    if (forceMax) {
      global.mainWindow.maximize()
    } else {
      if (global.mainWindow.isMaximized()) {
        global.mainWindow.unmaximize()
      } else {
        global.mainWindow.maximize()
      }
    }
  })
  ipcMain.on('window-close', () => {
    // 确认退出：立即真正退出（app.exit 不触发 before-quit，不会与确认框拦截死循环）。
    // 清理全部尽力而为且不阻塞：destroyAll 可能因 worker 卡住而挂起、destroyTray 可能抛错，
    // 都不能影响退出 —— 之前 await 清理导致确认后"没反应"
    try {
      destroyTray()
    } catch {
      /* 托盘清理失败不影响退出 */
    }
    workflowManager.cleanup().catch(() => {})
    // 等待配置写入落库后退出，防丢最近一次 set
    flushStore().finally(() => app.exit(0))
  })
  // 注册路径选择对话框处理
  ipcMain.handle('dialog:openPath', async (event, options) => {
    if (!options.defaultPath) {
      options.defaultPath = get('allowedRoot')
    } else {
      //首先获取真实路径
      let realPath = path.resolve(options.defaultPath)
      //判断默认展示目录是否存在不存在打开安全目录
      if (!fs.existsSync(realPath)) {
        realPath = get('allowedRoot')
      }
      options.defaultPath = realPath
    }

    const result = await dialog.showOpenDialog(global.mainWindow, options)
    return result
  })

  ipcMain.handle('dialog:savePath', async (event, options) => {
    if (!options.defaultPath) {
      options.defaultPath = get('allowedRoot')
    } else {
      //首先获取真实路径
      let realPath = path.resolve(options.defaultPath)
      //判断默认展示目录是否存在不存在打开安全目录
      if (!fs.existsSync(realPath)) {
        realPath = get('allowedRoot')
      }
      options.defaultPath = realPath
    }
    options.defaultPath = path.join(options.defaultPath, options.defaultFilename || '导出文件')
    const result = await dialog.showSaveDialog(global.mainWindow, options)
    return result
  })

  ipcMain.handle('shell:openPath', async (event, path) => {
    shell.openPath(path)
  })

  ipcMain.handle('shell:openExternal', async (event, url) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('app:getMousePos', () => {
    const pos = screen.getCursorScreenPoint()
    return pos
  })
  // 注册获取鼠标位置API
  ipcMain.handle('app:startGetMousePos', () => {
    app.hide()
  })
  ipcMain.handle('app:stopGetMousePos', () => {
    app.show()
  })

  ipcMain.handle('app:getPlatform', () => {
    return process.platform
  })

  ipcMain.handle('app:getVersion', () => {
    // 用 package.json 的 version：dev/preview（electron-vite）下 app.getVersion() 不可靠，可能为空或返回 Electron 自身版本
    return pkg.version
  })

  /** 语义化版本比较：1.10.0 > 1.9.0（逐段数字，避免字符串比较的坑） */
  const compareVersions = (a, b) => {
    const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0)
    const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0)
    const len = Math.max(pa.length, pb.length)
    for (let i = 0; i < len; i++) {
      const na = pa[i] || 0
      const nb = pb[i] || 0
      if (na > nb) return 1
      if (na < nb) return -1
    }
    return 0
  }

  /** 版本接口的平台参数（与网站 fr_app_versions 平台字段一致） */
  const updatePlatformKey = () => {
    if (process.platform === 'darwin') return 'macos'
    if (process.platform === 'win32') return 'windows'
    return 'linux'
  }

  /**
   * 检查更新：请求网站 GET /api/version/latest?platform=xxx
   * 返回 { hasUpdate, version, updateLog, downloadUrl, currentVersion, error }
   * 网络/接口异常不抛错，返回 error 供渲染端提示「检查更新失败」
   */
  ipcMain.handle('app:checkUpdate', async () => {
    try {
      const url = `${API_CONFIG.BASE_URL}/version/latest?platform=${updatePlatformKey()}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      let res
      try {
        res = await fetch(url, { signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      const data = body?.data
      if (!data || !data.version) {
        return { hasUpdate: false, error: '' }
      }
      const hasUpdate = compareVersions(data.version, pkg.version) > 0
      return {
        hasUpdate,
        version: data.version,
        updateLog: data.updateLog || '',
        downloadUrl: data.downloadUrl || '',
        currentVersion: pkg.version
      }
    } catch (e) {
      console.error('[update] 检查更新失败:', e?.message || e)
      return { hasUpdate: false, error: e?.message || String(e) }
    }
  })



  ipcMain.handle('system:showNotification', (event, options) => {
    try {
      if (!Notification.isSupported()) {
        console.warn('[notice] 当前系统不支持系统通知（Notification.isSupported() = false）')
        return { ok: false, error: '系统不支持通知' }
      }
      const n = new Notification(options)
      const eventCallback = (params) => {
        sendToRenderer('system:showNotification:on:' + options.id, params)
      }
      n.on('click', () => {
        global.mainWindow.show()
        global.mainWindow.focus()
        eventCallback({
          action: 'click'
        })
      })
      n.show()
      console.log('[notice] 系统通知已发送:', options?.title)
      return { ok: true }
    } catch (error) {
      console.error('[notice] 系统通知发送失败:', error?.message || error)
      return { ok: false, error: error?.message || String(error) }
    }
  })
}
