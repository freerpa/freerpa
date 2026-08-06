import { app, BaseWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import '../menu'
import pkg from '../../../package.json'
import { createWindow } from './window'
import { register as workflowRegisterIPC } from '../workflow/ipc'
import { register as dataRegisterIPC } from '../data'
import { register as envRegisterIPC } from '../browser/ipc'
import { register as storeRegisterIPC } from '../store/ipc'
import { register as registerIPC } from '../ipc'
import { register as cacheRegisterIPC } from '../cache/ipc'
import { register as dbInfoRegisterIPC } from '../data/dbIpc'
import { register as pluginRegisterIPC } from '../plugin/ipc'
import { registerDecryptIpc } from '../crypto'

/**
 * 应用启动引导
 */
export const bootstrap = async () => {
  global.appName = pkg.name
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('ignore-certificate-errors')

  await app.whenReady()

  // 单实例锁
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    if (!is.dev) app.quit()
    return
  }

  app.on('second-instance', () => {
    try {
      if (global.mainWindow) {
        if (global.mainWindow.isMinimized()) global.mainWindow.restore()
        global.mainWindow.focus()
      }
    } catch {
      // 窗口可能已被销毁
    }
  })

  // 创建主窗口
  const { win, view } = createWindow()
  global.mainWindow = win
  global.mainView = view

  // 退出时清理所有浏览器与引擎宿主
  app.on('before-quit', async () => {
    try {
      const { closeAllBrowsers } = await import('../browser/manager')
      await closeAllBrowsers()
    } catch (_) {}
    try {
      const { default: EngineHost } = await import('../workflow/host/index')
      await EngineHost.shutdown()
    } catch (_) {}
  })

  // 注册所有 IPC 处理
  workflowRegisterIPC()
  dataRegisterIPC()
  envRegisterIPC()
  storeRegisterIPC()
  cacheRegisterIPC()
  dbInfoRegisterIPC()
  pluginRegisterIPC()
  registerDecryptIpc()
  registerIPC()

  // macOS 激活事件
  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
      const { win: newWin, view: newView } = createWindow()
      global.mainWindow = newWin
      global.mainView = newView
    }
  })
}
