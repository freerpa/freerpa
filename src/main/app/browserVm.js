/**
 * @file: 浏览器 VM（offscreen WebContentsView）
 * @description: 创建一个离屏的 WebContentsView 用于执行用户 JavaScript 代码
 * 通过 IPC + webContents.executeJavaScript 替代 Puppeteer
 */

import { WebContentsView, session, ipcMain } from 'electron'
import path from 'path'

let bvmView = null
const bvmCallbacks = new Map()

// IPC handler：bvm 页面通过 preload 发送回调
ipcMain.handle('bvm:callback', (_event, fnName, outputs) => {
  const callback = bvmCallbacks.get(fnName)
  if (callback) {
    callback(outputs)
  }
})

export const createBvm = async () => {
  const win = global.mainWindow

  // 销毁旧实例
  if (bvmView) {
    win.contentView.removeChildView(bvmView)
    bvmView.webContents.close()
    bvmView = null
  }

  const customSession = session.fromPartition('persist:env_browser-vm')

  const view = new WebContentsView({
    webPreferences: {
      session: customSession,
      preload: path.join(__dirname, '../preload/bvm.js'),
      webSecurity: false,
      offscreen: true,
      backgroundThrottling: false,
      devTools: false
    }
  })

  view.webContents.setFrameRate(1)
  view.webContents.setAudioMuted(true)
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  win.contentView.addChildView(view)
  view.setBounds({ x: -1919, y: -1079, width: 1280, height: 720 })

  // 阻止导航 & 新窗口 & 下载
  view.webContents.on('will-navigate', (e) => e.preventDefault())
  view.webContents.on('new-window', (e) => e.preventDefault())
  customSession.on('will-download', (e) => e.preventDefault())

  // 加载空白页
  await view.webContents.loadURL('about:blank')

  bvmView = view
  global.bvmWebContents = view.webContents
}

/**
 * 注册 bvm 回调函数
 * @param {string} fnName - 回调函数名
 * @param {Function} callback - 回调函数
 */
export const registerBvmCallback = (fnName, callback) => {
  bvmCallbacks.set(fnName, callback)
}

/**
 * 移除 bvm 回调函数
 * @param {string} fnName - 回调函数名
 */
export const removeBvmCallback = (fnName) => {
  bvmCallbacks.delete(fnName)
}

global.createBvm = createBvm
global.registerBvmCallback = registerBvmCallback
global.removeBvmCallback = removeBvmCallback
