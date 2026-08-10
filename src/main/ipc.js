import { ipcMain, screen, dialog, shell, app, Notification } from 'electron'
import { sendToRenderer } from './workflow/host/rendererUtils'
import { manager as workflowManager } from './workflow/index'
import { get, flush as flushStore } from './store/index'
import { destroyTray } from './app/tray'
import fs from 'fs'
import path from 'path'
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



  ipcMain.handle('system:showNotification', (event, options) => {
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
  })
}
