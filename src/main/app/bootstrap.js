import { app, powerSaveBlocker } from 'electron'
import { is } from '@electron-toolkit/utils'
import '../menu'
import pkg from '../../../package.json'
import { initDatabase } from '../data/db'
import { load as loadStore } from '../store/index'
import { migrateLegacyPreferences } from '../store/migrate'
import { createWindow } from './window'
import { createTray } from './tray'
import { ensureDefaultPermissions } from '../workflow/permissions'
import { register as workflowRegisterIPC } from '../workflow/ipc'
import { register as dataRegisterIPC } from '../data'
import { register as envRegisterIPC } from '../browser/ipc'
import { register as storeRegisterIPC } from '../store/ipc'
import { register as registerIPC } from '../ipc'
import { register as cacheRegisterIPC } from '../cache/ipc'
import { register as dbInfoRegisterIPC } from '../data/dbIpc'
import { register as pluginRegisterIPC } from '../plugin/ipc'
import { registerDecryptIpc } from '../crypto'
import { register as aiRegisterIPC } from '../ai'

/**
 * 应用启动引导
 */
export const bootstrap = async () => {
  global.appName = pkg.name
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('ignore-certificate-errors')

  await app.whenReady()

  // 后台保活：防止系统挂起/优化回收（配合 disable-renderer-backgrounding 防渲染进程降频）
  powerSaveBlocker.start('prevent-app-suspension')

  // 单实例锁
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    if (!is.dev) app.quit()
    return
  }

  // 一次性迁移旧配置（user-preferences JSON → settings 表），随后加载配置
  await migrateLegacyPreferences()
  const appDb = await initDatabase()
  await loadStore(appDb)
  // 首次启动写入最安全默认权限（含预置 FREERPA-DATA 目录）；已有配置则跳过
  ensureDefaultPermissions()

  // 日活/使用统计上报（静默失败，不影响主流程）
  try {
    const { initStats } = await import('../stats/index.js')
    await initStats(appDb)
  } catch {
    // 统计上报失败不阻塞启动
  }

  app.on('second-instance', () => {
    try {
      if (global.mainWindow) {
        if (global.mainWindow.isMinimized()) global.mainWindow.restore()
        global.mainWindow.show()
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

  // 系统托盘（后台运行入口：单击展开状态小窗 / 右键菜单退出）
  createTray()

  // 退出拦截（生产模式：Dock 右键 Quit / Cmd+Q / 菜单退出 / 托盘退出统一入口）：
  // 不直接退出，恢复主窗口并触发渲染端确认框（与托盘「退出软件」一致），确认后走 app.exit(0)。
  // 开发模式直接放行：Ctrl+C / Cmd+Q 跟随退出，便于调试
  app.on('before-quit', (event) => {
    if (is.dev) return
    event.preventDefault()
    if (global.mainWindow && !global.mainWindow.isDestroyed()) {
      if (global.mainWindow.isMinimized()) global.mainWindow.restore()
      global.mainWindow.show()
      global.mainWindow.focus()
    }
    try {
      global.mainView?.webContents.send('request-exit')
    } catch {
      // 渲染进程不可用时直接退出
      app.exit(0)
    }
  })

  // 注册所有 IPC 处理
  workflowRegisterIPC()
  dataRegisterIPC()
  envRegisterIPC()
  storeRegisterIPC()
  cacheRegisterIPC()
  dbInfoRegisterIPC()
  pluginRegisterIPC()
  aiRegisterIPC()
  registerDecryptIpc()
  registerIPC()

  // 所有窗口关闭：生产模式保持后台常驻（主窗口与小窗均为隐藏语义，托盘常驻）；
  // 开发模式窗口关闭即退出（配合 close 放行，点关闭按钮 = 直接退出）
  app.on('window-all-closed', () => {
    if (is.dev) app.quit()
  })

  // macOS 激活事件：隐藏时恢复主窗口；无窗口才重建
  app.on('activate', () => {
    if (global.mainWindow && !global.mainWindow.isDestroyed()) {
      global.mainWindow.show()
      global.mainWindow.focus()
      return
    }
    const { win: newWin, view: newView } = createWindow()
    global.mainWindow = newWin
    global.mainView = newView
  })
}
