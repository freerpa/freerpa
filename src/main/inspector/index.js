/**
 * @file: 检查器模块
 * @author: dabao
 * @date: 2024-03-16
 */

import { sendToRenderer } from '../workflow/core/utils/rendererUtils'
import { API_CONFIG } from '@/api/config'
import { createEnvView, setUserAgent } from '@/common'

// 存储当前活动的 WebContentsView
let activeView = null
let isHide = false
const defaultUrl = API_CONFIG.BASE_URL + '/selectorGuide?system'

// 处理IPC消息
const registIpc = async (view) => {
  view.webContents.on('ipc-message', (event, type, data) => {
    if (type === 'selector') {
      let { xpath, selector } = data
      if (event.senderFrame.parent) {
        xpath = `---iframe${event.senderFrame.routingId}---> ` + xpath
        selector = `---iframe${event.senderFrame.routingId}---> ` + selector
      }
      sendToRenderer('env:inspector', { xpath, selector })
    } else if (type === 'mouseenter') {
      if (!view.webContents.isFocused()) {
        view.webContents.focus()
      }
    }
  })
}

// 创建 WebContentsView
export const createWebView = async ({ url, bounds, env, force = false }) => {
  if (activeView) {
    if (!force) {
      // 显示已存在的 view
      isHide = false
      activeView.setVisible(true)
      return
    } else {
      // 从窗口中移除
      global.mainWindow.contentView.removeChildView(activeView)
      // 销毁已存在的 view
      activeView.webContents.close()
      activeView = null
    }
  }

  const view = await createEnvView(env, { type: 'inspector', inspector: true })
  if (isHide) {
    view.setVisible(false)
  }
  view.webContents.setAudioMuted(true)
  activeView = view



  registIpc(view)

  // 添加到窗口
  global.mainWindow.contentView.addChildView(view)
  view.webContents.focus()
  // 加载URL
  await view.webContents.loadURL(url || defaultUrl).catch(() => { })

  // 设置位置和大小
  view.setBounds(bounds)
  // 初始化缩放比例
  view.webContents.setZoomFactor(0.8)
  return view.id
}

// 更新 WebContentsView
export const updateWebView = async ({ bounds, url, env }) => {
  if (!activeView) return

  if (bounds) {
    activeView.setBounds(bounds)
  }

  // 设置userAgent
  const isSetUserAgent = setUserAgent(activeView, env)
  if (url && (url !== activeView.webContents.getURL() || isSetUserAgent)) {
    await activeView.webContents.loadURL(url).catch(() => { })
  } else if (isSetUserAgent) {
    activeView.webContents.reload()
  }
}

// 销毁 WebContentsView
export const destroyWebView = async () => {
  if (activeView) {
    // 隐藏
    isHide = true
    activeView.setVisible(false)
  }
}

// 导航控制
export const goBack = async () => {
  await activeView?.webContents.navigationHistory.goBack()
}

export const goForward = async () => {
  await activeView?.webContents.navigationHistory.goForward()
}

export const refresh = async () => {
  await activeView?.webContents.reload()
}

export const debug = async () => {
  await activeView?.webContents.openDevTools()
}

export const clear = async () => {
  await activeView?.webContents.session.clearCache()
  await activeView?.webContents.session.clearData(
    {
      dataTypes: [
        'cache',
        'cookies',
        'backgroundFetch',
        'storage',
        'fileSystems',
        'indexedDB',
        'localStorage',
        'serviceWorkers',
        'webSQL',
        'downloads'
      ]
    }
  )
  activeView.webContents.reloadIgnoringCache()
}