import { ipcMain, screen, dialog, shell, app, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'
import { sendToRenderer } from './workflow/core/utils/rendererUtils'
import { manager as workflowManager } from './workflow/index'
import { get } from './store/index'
import fs from 'fs'
import path from 'path'
export const register = () => {
  // 窗口控制
  ipcMain.on('window-min', () => global.mainWindow.minimize())
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
  ipcMain.on('window-fullscreen', () => {
    global.mainWindow.setFullScreen(!global.mainWindow.isFullScreen())
  })
  ipcMain.on('window-close', async () => {
    await workflowManager.cleanup()
    app.exit(0)
  })
  ipcMain.on('window-size', (event, width, height) => {
    const setSize = () => {
      global.mainWindow.setSize(width, height)
      global.mainWindow.center()
    }
    if (process.platform === 'darwin') {
      if (!global.mainWindow.isFullScreen()) {
        setSize()
        return
      } else {
        global.mainWindow.once('leave-full-screen', () => {
          setSize()
        })
        global.mainWindow.setFullScreen(false)
      }
    } else if (process.platform === 'win32') {
      global.mainWindow.unmaximize()
      setSize()
    }
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
    shell.openExternal(url)
  })

  ipcMain.handle('app:getMousePos', (event) => {
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

  ipcMain.handle('app:updateApp', (event, url) => {
    autoUpdater.setFeedURL(url)
    autoUpdater.forceDevUpdateConfig = true //开发环境下强制更新
    autoUpdater.autoDownload = true // 自动下载
    autoUpdater.on('download-progress', (prog) => {
      const speed =
        prog.bytesPerSecond / 1000000 > 1
          ? Math.ceil(prog.bytesPerSecond / 1000000) + 'M/s'
          : Math.ceil(prog.bytesPerSecond / 1000) + 'K/s'
      sendToRenderer('download-progress', {
        speed, // 网速
        percent: Math.ceil(prog.percent) // 百分比
      })
    })
    autoUpdater.on('update-downloaded', async () => {
      await workflowManager.cleanup()
      app.releaseSingleInstanceLock()
      autoUpdater.quitAndInstall(true, true)
    })
    autoUpdater.checkForUpdatesAndNotify()
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
