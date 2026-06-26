/**
 * @file: 浏览器预览窗口管理
 * @author: dabao / FreeRPA
 *
 * 使用 fingerprint-chromium 替代 WebContentsView
 * 浏览器编辑器预览改用独立窗口模式（不再内嵌）
 */

import { BaseWindow } from 'electron'
import { API_CONFIG } from '@/api/config'
import { createEnvView } from './viewer'
import { setUserAgent } from './ua'

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

      cookies = await page.cookies()
    } catch (e) {
      console.warn('getEnvironmentFromView failed:', e.message)
    }
  }

  return { storage, cookies }
}

// 创建浏览器窗口
export const createWebView = async ({ url, bounds, env }) => {
  if (activeView) {
    activeView.webContents.close()
    activeView = null
  }
  if (activeWindow) {
    try { activeWindow.destroy() } catch (e) {}
    activeWindow = null
  }

  isDestroyed = false

  try {
    const view = await createEnvView(env, { type: 'env' })

    if (isDestroyed) {
      view.webContents.close()
      isDestroyed = false
      return view.id
    }

    activeView = view

    const window = new BaseWindow({
      width: bounds?.width || 1280,
      height: bounds?.height || 720,
      title: env?.name || '浏览器预览',
      show: true,
      roundedCorners: false
    })

    window.on('close', () => {
      activeView?.webContents.close()
      activeView = null
      activeWindow = null
    })

    activeWindow = window

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
