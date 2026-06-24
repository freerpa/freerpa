/**
 * @file: 环境管理模块
 * @author: dabao
 * @date: 2024-03-16
 */

import { API_CONFIG } from '@/api/config'
import { createEnvView, setUserAgent } from '@/common'

// 存储当前活动的 WebContentsView
let activeView = null
let isDestroyed = false
const defaultUrl = API_CONFIG.BASE_URL + '/envGuide?system'

// 获取当前 WebContentsView 的状态
export const getEnvironmentFromView = async () => {
  // 从当前活动的 WebContentsView 获取状态
  let storage = null
  let cookies = null
  if (activeView) {
    const webContents = activeView.webContents

    // 获取存储数据
    storage = await webContents.executeJavaScript(`
      JSON.parse(JSON.stringify({
         localStorage: Object.entries(localStorage).reduce((acc, [key, value]) => {
           acc[key] = value
           return acc
         }, {}),
         sessionStorage: Object.entries(sessionStorage).reduce((acc, [key, value]) => {
           acc[key] = value
           return acc
         }, {})
      }))
     `)

    // 获取所有cookies
    cookies = await webContents.session.cookies.get({})
  }

  return { storage, cookies }
}

// 创建 WebContentsView
export const createWebView = async ({ url, bounds, env }) => {
  // 销毁已存在的 view
  if (activeView) {
    activeView.webContents.close()
    activeView = null
  }
  //开始创建之前重置销毁状态
  if (isDestroyed) {
    isDestroyed = false
  }
  // 创建新的 view并设置chrome的UA
  const view = await createEnvView(env, { type: 'env' })
  // 如果在创建过程中被销毁，关闭新创建的view并返回
  if (isDestroyed) {
    view.webContents.close()
    isDestroyed = false
    return view.id
  }

  // view.webContents.openDevTools()
  activeView = view
  // 添加到窗口
  global.mainWindow.contentView.addChildView(view)

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
    // 从窗口中移除
    global.mainWindow.contentView.removeChildView(activeView)
    activeView.webContents.close()
  }
  isDestroyed = true
  activeView = null
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