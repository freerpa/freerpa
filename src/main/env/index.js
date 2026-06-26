/**
 * @file: 环境管理模块
 * @author: dabao / FreeRPA
 * @date: 2024-03-16
 *
 * 使用 fingerprint-chromium 替代 WebContentsView
 * 环境编辑器预览改用独立窗口模式（不再内嵌）
 */

import { BaseWindow } from 'electron'
import { API_CONFIG } from '@/api/config'
import { createEnvView, setUserAgent } from '@/common'

// 存储当前活动的浏览器实例
let activeView = null
let activeWindow = null
let isDestroyed = false
const defaultUrl = API_CONFIG.BASE_URL + '/envGuide?system'

// 获取当前浏览器的状态
export const getEnvironmentFromView = async () => {
  let storage = null
  let cookies = null
  if (activeView?.puppeteerPage) {
    const page = activeView.puppeteerPage
    try {
      // 获取存储数据
      storage = await page.evaluate(() => {
        return JSON.parse(JSON.stringify({
          localStorage: Object.entries(localStorage).reduce((acc, [key, value]) => {
            acc[key] = value
            return acc
          }, {}),
          sessionStorage: Object.entries(sessionStorage).reduce((acc, [key, value]) => {
            acc[key] = value
            return acc
          }, {})
        }))
      })

      // 获取所有cookies
      cookies = await page.cookies()
    } catch (e) {
      console.warn('getEnvironmentFromView failed:', e.message)
    }
  }

  return { storage, cookies }
}

// 创建浏览器窗口（使用 fingerprint-chromium）
export const createWebView = async ({ url, bounds, env }) => {
  // 销毁已存在的实例
  if (activeView) {
    activeView.webContents.close()
    activeView = null
  }
  if (activeWindow) {
    try { activeWindow.destroy() } catch (e) {}
    activeWindow = null
  }

  // 重置销毁状态
  isDestroyed = false

  try {
    // 使用 fingerprint-chromium 创建浏览器
    const view = await createEnvView(env, { type: 'env' })

    if (isDestroyed) {
      view.webContents.close()
      isDestroyed = false
      return view.id
    }

    activeView = view

    // 为浏览器创建独立窗口（不再内嵌到主窗口）
    const window = new BaseWindow({
      width: bounds?.width || 1280,
      height: bounds?.height || 720,
      title: env?.name || '环境预览',
      show: true,
      roundedCorners: false
    })

    window.on('close', () => {
      activeView?.webContents.close()
      activeView = null
      activeWindow = null
    })

    activeWindow = window

    // 加载URL
    if (url) {
      await view.webContents.loadURL(url).catch(() => {})
    } else {
      await view.webContents.loadURL(defaultUrl).catch(() => {})
    }

    return view.id
  } catch (error) {
    console.error('createWebView failed:', error)
    throw error
  }
}

// 更新浏览器
export const updateWebView = async ({ bounds, url, env }) => {
  if (!activeView) return

  // 设置userAgent
  const isSetUserAgent = setUserAgent(activeView, env)

  if (url && activeView.puppeteerPage) {
    const currentUrl = activeView.puppeteerPage.url()
    if (url !== currentUrl || isSetUserAgent) {
      await activeView.webContents.loadURL(url).catch(() => {})
    }
  }
}

// 销毁浏览器
export const destroyWebView = async () => {
  if (activeView) {
    activeView.webContents.close()
  }
  if (activeWindow) {
    try { activeWindow.destroy() } catch (e) {}
  }
  isDestroyed = true
  activeView = null
  activeWindow = null
}

// 导航控制
export const goBack = async () => {
  try {
    await activeView?.puppeteerPage?.goBack()
  } catch (e) {}
}

export const goForward = async () => {
  try {
    await activeView?.puppeteerPage?.goForward()
  } catch (e) {}
}

export const refresh = async () => {
  try {
    await activeView?.puppeteerPage?.reload()
  } catch (e) {}
}

export const debug = async () => {
  console.warn('debug (openDevTools) not available for fingerprint-chromium')
}

export const clear = async () => {
  if (activeView?.puppeteerPage) {
    const page = activeView.puppeteerPage
    try {
      const client = await page.target().createCDPSession()
      await client.send('Network.clearBrowserCache')
      await client.send('Network.clearBrowserCookies')
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
    } catch (e) {
      console.warn('clear failed:', e.message)
    }
  }
}
