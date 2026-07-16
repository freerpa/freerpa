import { app, BaseWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import '../menu'
import pkg from '../../../package.json'
import { createWindow } from './window'
import { createBvm } from './browserVm'
import { register as workflowRegisterIPC } from '../workflow/ipc'
import { register as dataRegisterIPC } from '../data'
import { register as envRegisterIPC } from '../browser/ipc'
import { register as storeRegisterIPC } from '../store/ipc'
import { register as apiRegisterIPC } from '../api/ipc'
import { register as registerIPC } from '../ipc'
import { register as systemRegisterIPC } from '../system/ipc'
import { register as cacheRegisterIPC } from '../cache/ipc'
import { register as dbInfoRegisterIPC } from '../data/dbIpc'
import { register as pluginRegisterIPC } from '../plugin/ipc'

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

  // 退出时清理所有浏览器
  app.on('before-quit', async () => {
    try {
      const { closeAllBrowsers } = await import('../browser/manager')
      await closeAllBrowsers()
    } catch (_) {}
  })

  // 注册所有 IPC 处理（必须在 createBvm 之前）
  // bvm 创建 WebContentsView 时渲染进程可能发送 IPC 请求，必须先注册 handlers
  workflowRegisterIPC()
  dataRegisterIPC()
  envRegisterIPC()
  storeRegisterIPC()
  apiRegisterIPC()
  systemRegisterIPC()
  cacheRegisterIPC()
  dbInfoRegisterIPC()
  pluginRegisterIPC()
  registerIPC()

  // 创建浏览器 VM（fire-and-forget，匹配原始语义）
  createBvm()

  // macOS 激活事件
  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
      const { win: newWin, view: newView } = createWindow()
      global.mainWindow = newWin
      global.mainView = newView
    }
  })
}
