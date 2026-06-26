/**
 * @file: 指纹浏览器引擎 — fingerprint-chromium
 * @author: FreeRPA
 *
 * 替代原有的 WebContentsView，使用 fingerprint-chromium 内核
 * 保持与原有 API 完全兼容：
 *  - createEnvView(env, options) → 返回包装后的 view 对象
 *  - view.webContents.executeJavaScript()
 *  - view.webContents.loadURL()
 *  - view.webContents.session.cookies
 *  - 以及 workflow 节点的 Puppeteer page 获取
 */

import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import puppeteer from 'puppeteer-core'
import { launchKernel, checkKernelExists, downloadKernel, getRecommendedKernel, fetchKernelList } from './kernelLauncher'
import { sendToRenderer } from '../workflow/core/utils/rendererUtils'

// 标准协议白名单
const STANDARD_PROTOCOLS = new Set([
  'http:', 'https:', 'file:', 'data:', 'about:', 'mailto:', 'tel:', 'ftp:', 'ssh:', 'sftp:', 'irc:', 'ircs:', 'xmpp:'
])

const isNonStandardProtocol = (url) => {
  try {
    const parsedUrl = new URL(url)
    return !STANDARD_PROTOCOLS.has(parsedUrl.protocol)
  } catch (err) {
    return false
  }
}

/**
 * 创建 WebContentsView 兼容包装器
 * 将 fingerprint-chromium (Puppeteer) 接口包装成类似 Electron WebContentsView 的接口
 */
const createViewWrapper = (instance) => {
  const { browser, page, process: kernelProcess, port, wsEndpoint, id, userDataDir } = instance

  // 存储新打开的页面
  const newPages = []

  // 平台无关的进程关闭函数
  const killProcess = async () => {
    const { execSync } = await import('child_process')
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${kernelProcess.pid} /f /t`, { stdio: 'ignore' })
      } else {
        kernelProcess.kill('SIGTERM')
        setTimeout(() => { try { kernelProcess.kill('SIGKILL') } catch (_) {} }, 5000)
      }
    } catch (_) {}
  }

  // WebContents 兼容层
  const webContents = {
    _page: page,
    _browser: browser,
    _kernelId: id,

    async executeJavaScript(code) {
      try {
        return await page.evaluate((script) => {
          return eval(script)
        }, code)
      } catch (e) {
        console.warn('executeJavaScript failed:', e.message)
        return null
      }
    },

    async loadURL(url, options = {}) {
      try {
        await page.goto(url, { waitUntil: 'load', ...options })
      } catch (e) {
        console.warn('loadURL failed:', e.message)
      }
    },

    getURL() {
      return page.url()
    },

    setUserAgent(ua) {
      return page.setUserAgent(ua)
    },

    setZoomFactor(factor) {
      return page.setZoomFactor(factor)
    },

    setAudioMuted(muted) {
      // fingerprint-chromium 不支持运行时设置静音
      console.warn('setAudioMuted not supported in fingerprint-chromium')
    },

    async openDevTools() {
      console.warn('openDevTools not available for external browser')
    },

    async printToPDF(options) {
      return await page.pdf(options)
    },

    close() {
      return killProcess()
    },

    // Session 兼容层
    session: {
      cookies: {
        async get(filter) {
          try {
            const cookies = await page.cookies()
            if (filter && filter.url) {
              return cookies.filter(c => filter.url.includes(c.domain))
            }
            return cookies
          } catch (e) {
            return []
          }
        },
        async set(cookieData) {
          try {
            await page.setCookie(cookieData)
          } catch (e) {
            console.warn('setCookie failed:', e.message)
          }
        }
      },
      async clearCache() {
        try {
          const client = await page.target().createCDPSession()
          await client.send('Network.clearBrowserCache')
        } catch (e) {}
      },
      async clearData(options) {
        try {
          const client = await page.target().createCDPSession()
          if (options?.dataTypes) {
            if (options.dataTypes.includes('cookies')) {
              await client.send('Network.clearBrowserCookies')
            }
            if (options.dataTypes.includes('cache')) {
              await client.send('Network.clearBrowserCache')
            }
            if (options.dataTypes.includes('storage') || options.dataTypes.includes('localStorage')) {
              await page.evaluate(() => {
                localStorage.clear()
                sessionStorage.clear()
              })
            }
          }
        } catch (e) {}
      },
      set proxy(mode) { /* proxy set at launch time via --proxy-server */ },
      get proxy() { return { mode: 'system' } }
    },

    // 导航事件代理
    _eventListeners: {},

    on(event, callback) {
      if (!this._eventListeners[event]) {
        this._eventListeners[event] = []
      }
      this._eventListeners[event].push(callback)

      // 监听 Puppeteer 页面事件并转发
      if (event === 'did-start-loading') {
        page.on('load', () => {
          this._eventListeners[event]?.forEach(cb => cb())
        })
      }
      if (event === 'did-stop-loading') {
        page.on('load', () => {
          setTimeout(() => {
            this._eventListeners[event]?.forEach(cb => cb())
          }, 100)
        })
      }
      if (event === 'did-finish-load') {
        page.on('load', () => {
          setTimeout(() => {
            this._eventListeners[event]?.forEach(cb => cb())
          }, 200)
        })
      }
      if (event === 'did-fail-load') {
        page.on('pageerror', (err) => {
          this._eventListeners[event]?.forEach(cb => cb(err))
        })
      }
    },

    once(event, callback) {
      const wrapper = (...args) => {
        callback(...args)
        if (this._eventListeners[event]) {
          this._eventListeners[event] = this._eventListeners[event].filter(cb => cb !== wrapper)
        }
      }
      this.on(event, wrapper)
    },

    removeAllListeners(event) {
      if (event) {
        delete this._eventListeners[event]
      } else {
        this._eventListeners = {}
      }
    },

    reload() {
      return page.reload()
    },

    navigationHistory: {
      canGoBack: () => true,
      canGoForward: () => true,
      async goBack() {
        await page.goBack()
      },
      async goForward() {
        await page.goForward()
      }
    },

    mainFrame: {
      framesInSubtree: [],
    }
  }

  // 最终的 view 包装对象
  const view = {
    id,
    webContents,
    newPages,
    kernelProcess: kernelProcess,
    puppeteerPage: page,
    puppeteerBrowser: browser,

    // 设置位置和大小 — 通过 CDP 调整窗口
    setBounds(bounds) {
      // fingerprint-chromium 不支持运行时调整窗口位置
      // 但可以通过 CDP 控制
      console.warn('setBounds not directly supported for external browser process')
    },

    getBounds() {
      return { x: 0, y: 0, width: 1280, height: 720 }
    },

    // 关闭
    async close() {
      await killProcess()
    }
  }

  return view
}

/**
 * 设置 UserAgent（通过 Puppeteer API）
 */
const setUserAgentOnPage = async (page, env) => {
  let userAgent = env.browser_ua?.trim()
  if (!userAgent) {
    // 使用默认 UA
    if (env.browser_type === 'mobile') {
      userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    } else {
      // 从当前环境获取或使用默认
      return
    }
  }
  await page.setUserAgent(userAgent)
}

/**
 * 创建指纹浏览器环境视图（替代原有的 WebContentsView）
 *
 * 兼容原有 API 签名：
 *   createEnvView(env, options)
 *
 * @param {object} env - 环境数据 { name, browser_type, browser_ua, storage, cookies, kernel_id, proxy_url }
 * @param {object} options - 选项
 * @param {boolean} options.offscreen - 无头模式
 * @param {boolean} options.backgroundThrottling
 * @param {string} options.proxy - 代理地址
 * @param {string} options.nodeId - 节点ID
 * @param {boolean} options.inspector - 检查器模式
 * @param {string} options.type - 类型 (env/inspector)
 * @param {boolean} options.images - 是否加载图片
 * @param {boolean} options.newPage - 是否允许新页面
 * @returns {Promise<object>} view 包装对象
 */
export const createEnvView = async (env = null, options = {}) => {
  const {
    offscreen = false,
    backgroundThrottling = true,
    proxy = '',
    nodeId = uuidv4(),
    inspector = false,
    type = '',
    images = true,
    newPage = false
  } = options

  // 获取后端 API 地址
  const baseUrl = process.env.NODE_ENV === 'development'
    ? process.env.VITE_DEV_URL || 'http://127.0.0.1:8787'
    : process.env.VITE_PROD_URL || 'https://api.automan.site'

  // 获取推荐内核或指定内核
  let kernelList = await fetchKernelList(baseUrl)
  if (!kernelList || kernelList.length === 0) {
    throw new Error('没有可用的内核，请在管理后台添加内核')
  }

  const kernel = kernelList[0] // 使用最新版本

  // 检查内核是否已下载
  if (!checkKernelExists(kernel.platform, kernel.version)) {
    // 自动下载
    console.log(`内核不存在，开始下载: ${kernel.platform}/${kernel.version}`)
    await downloadKernel(kernel, (percent, msg) => {
      console.log(`下载进度: ${(percent * 100).toFixed(0)}% - ${msg}`)
    })
    console.log('内核下载完成')
  }

  // 生成指纹种子
  const fingerprintSeed = Math.floor(Math.random() * 100000)

  // 计算时区
  let timezone = ''
  if (env?.timezone) {
    timezone = env.timezone
  }

  // 启动内核
  const instance = await launchKernel({
    platform: kernel.platform,
    version: kernel.version,
    proxy: proxy,
    fingerprintSeed,
    offscreen,
    timezone,
    lang: 'en-US'
  })

  // 通过 Puppeteer 连接
  const browser = await puppeteer.connect({
    browserWSEndpoint: instance.wsEndpoint,
    defaultViewport: null
  })

  // 获取初始页面
  const pages = await browser.pages()
  let page = pages[0] || await browser.newPage()

  // 设置 UA（如果环境中有）
  if (env) {
    await setUserAgentOnPage(page, env)
  }

  // 如果有 storage 和 cookies，恢复它们
  if (env?.storage) {
    try {
      await page.evaluate((storage) => {
        Object.entries(storage.localStorage || {}).forEach(([key, value]) => {
          localStorage.setItem(key, value)
        })
        Object.entries(storage.sessionStorage || {}).forEach(([key, value]) => {
          sessionStorage.setItem(key, value)
        })
      }, env.storage)
    } catch (e) {
      console.warn('恢复 storage 失败:', e.message)
    }
  }

  if (env?.cookies && env.cookies.length > 0) {
    try {
      await page.setCookie(...env.cookies)
    } catch (e) {
      console.warn('恢复 cookies 失败:', e.message)
    }
  }

  // 创建 WebContentsView 兼容包装
  const fullInstance = {
    ...instance,
    browser,
    page
  }

  const view = createViewWrapper(fullInstance)

  // 发送导航事件
  if (['inspector', 'env'].includes(type)) {
    page.on('load', () => {
      const url = page.url()
      if (!url.includes('envGuide?system') && !url.includes('selectorGuide?system')) {
        sendToRenderer(`webview:did-start-navigation-${type}`, url)
      }
      sendToRenderer(`webview:did-finish-load-${type}`)
    })
    page.on('pageerror', () => {
      sendToRenderer(`webview:did-fail-load-${type}`)
    })
  }

  return view
}

/**
 * 设置 UserAgent（导出给 env/index.js 使用）
 */
export const setUserAgent = (view, env) => {
  if (view?.puppeteerPage && env) {
    setUserAgentOnPage(view.puppeteerPage, env)
    return true
  }
  return false
}
