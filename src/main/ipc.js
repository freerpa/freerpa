import { ipcMain, screen, dialog, shell, app, Notification } from 'electron'
import { sendToRenderer } from './workflow/host/rendererUtils.js'
import { manager as workflowManager } from './workflow/index.js'
import { get, flush as flushStore } from './store/index.js'
import { destroyTray } from './app/tray.js'
import { compareSemver } from './utils.js'
import fs from 'fs'
import path from 'path'
import pkg from '../../package.json'
import { API_CONFIG } from './api/config.js'
import { getPlatformKey } from '../shared/platform.js'
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
  /** 归一对话框默认目录：请求目录不存在时回退安全目录（allowedRoot） */
  const resolveDialogDefaultPath = (requestedPath) => {
    const fallback = get('allowedRoot')
    if (!requestedPath) return fallback
    const realPath = path.resolve(requestedPath)
    return fs.existsSync(realPath) ? realPath : fallback
  }

  // 注册路径选择对话框处理
  ipcMain.handle('dialog:openPath', (event, options) => {
    options.defaultPath = resolveDialogDefaultPath(options.defaultPath)
    return dialog.showOpenDialog(global.mainWindow, options)
  })

  ipcMain.handle('dialog:savePath', (event, options) => {
    const basePath = resolveDialogDefaultPath(options.defaultPath)
    options.defaultPath = path.join(basePath, options.defaultFilename || '导出文件')
    return dialog.showSaveDialog(global.mainWindow, options)
  })

  ipcMain.handle('shell:openPath', async (event, path) => {
    shell.openPath(path)
  })

  // 目录浏览（自定义文件选择器用）：列出指定目录下的一级文件项（目录+文件，目录在前），供渲染端渲染 Windows 风格列表
  ipcMain.handle('fs:listDirectory', async (event, dirPath) => {
    const requested = typeof dirPath === 'string' ? dirPath : ''
    let resolved = requested
      ? path.resolve(requested)
      : app.getPath('homedir')
    try {
      const st = fs.statSync(resolved)
      if (!st.isDirectory()) return { ok: false, error: `不是有效目录: ${resolved}` }
    } catch {
      return { ok: false, error: `目录不存在: ${resolved}` }
    }
    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true })
        .map((e) => ({
          name: e.name,
          path: path.join(resolved, e.name),
          type: e.isDirectory() ? 'dir' : 'file'
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      return { ok: true, current: resolved, parent: path.dirname(resolved), entries }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  // 图片缩略（自定义文件选择器用）：返回图片 dataURL 缩小传输，避开地址栏 file:// 的安全限制
  ipcMain.handle('fs:readThumb', async (event, filePath) => {
    try {
      const resolved = typeof filePath === 'string' ? path.resolve(filePath) : ''
      const st = fs.statSync(resolved)
      if (!st.isFile()) return { ok: false, error: '不是有效文件' }
      if (st.size > 12 * 1024 * 1024) return { ok: false, error: '文件过大，不生成预览' }
      const ext = path.extname(resolved).slice(1).toLowerCase()
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'gif' ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : ext === 'svg' ? 'image/svg+xml'
        : ext === 'bmp' ? 'image/bmp'
        : ext === 'avif' ? 'image/avif'
        : ext === 'ico' ? 'image/vnd.microsoft.icon'
        : 'application/octet-stream'
      const buf = fs.readFileSync(resolved)
      return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  // 默认起始目录（主目录），供自定义目录选择器初始化导航位置
  ipcMain.handle('fs:getHome', () => app.getPath('homedir'))

  // 常见用户目录（文档/下载/桌面/主目录），供自定义目录选择器侧栏快速访问
  ipcMain.handle('fs:getUserDirs', async () => {
    const names = ['home', 'documents', 'downloads', 'desktop']
    const result = {}
    for (const n of names) {
      try {
        result[n] = app.getPath(n)
      } catch {
        result[n] = null
      }
    }
    result.root = path.parse(result.home || path.resolve('/')).root
    return result
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

  /**
   * 检查更新：请求网站 GET /api/version/latest?platform=xxx
   * 返回 { hasUpdate, version, updateLog, downloadUrl, currentVersion, error }
   * 网络/接口异常不抛错，返回 error 供渲染端提示「检查更新失败」
   */
  ipcMain.handle('app:checkUpdate', async () => {
    try {
      const url = `${API_CONFIG.BASE_URL}/version/latest?platform=${getPlatformKey()}`
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
      const hasUpdate = compareSemver(data.version, pkg.version) > 0
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
