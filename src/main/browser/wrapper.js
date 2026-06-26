/**
 * @file: WebContentsView 兼容包装器
 * @author: FreeRPA
 *
 * 将 fingerprint-chromium (Puppeteer) 接口包装成类似 Electron WebContentsView 的接口
 */

// 标准协议白名单
const STANDARD_PROTOCOLS = new Set([
  'http:', 'https:', 'file:', 'data:', 'about:', 'mailto:', 'tel:', 'ftp:', 'ssh:', 'sftp:', 'irc:', 'ircs:', 'xmpp:'
])

export const isNonStandardProtocol = (url) => {
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
export const createViewWrapper = (instance) => {
  const { browser, page, process: kernelProcess, port, wsEndpoint, id, userDataDir } = instance

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

    _eventListeners: {},

    on(event, callback) {
      if (!this._eventListeners[event]) {
        this._eventListeners[event] = []
      }
      this._eventListeners[event].push(callback)

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

  const view = {
    id,
    webContents,
    newPages: [],
    kernelProcess: kernelProcess,
    puppeteerPage: page,
    puppeteerBrowser: browser,

    setBounds(bounds) {
      console.warn('setBounds not directly supported for external browser process')
    },

    getBounds() {
      return { x: 0, y: 0, width: 1280, height: 720 }
    },

    async close() {
      await killProcess()
    }
  }

  return view
}
