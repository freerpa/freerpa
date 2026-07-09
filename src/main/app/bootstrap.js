import { app, BaseWindow } from 'electron'
import puppeteer from '../browser/puppeteer.js'
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
import { getCanUsePort } from './port'

/**
 * 应用启动引导
 */
export const bootstrap = async () => {
  global.appName = pkg.name
  // 设置远程调试端口
  const debugPort = getCanUsePort(9222)
  app.commandLine.appendSwitch('remote-debugging-port', debugPort)
  app.commandLine.appendSwitch('remote-allow-origins', '*')
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

  // Puppeteer 连接（连接内置 Chromium 调试端口）
  global.pptrConnect = async () => {
    global.browser = await puppeteer.connect({
      browserURL: `http://localhost:${debugPort}/`,
      defaultViewport: null
    })
  }

  await global.pptrConnect()

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

  // 注册所有 IPC 处理（必须在 createBvm 之前 —— createBvm 异步等待 did-fail-load 回调，
  // 此时渲染进程可能已开始发送 IPC 请求，必须先注册 handlers）
  workflowRegisterIPC()
  dataRegisterIPC()
  envRegisterIPC()
  storeRegisterIPC()
  apiRegisterIPC()
  systemRegisterIPC()
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
