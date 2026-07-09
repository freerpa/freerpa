/**
 * @file: 打开指纹浏览器
 * @author: FreeRPA
 *
 * openBrowser — 按浏览器配置启动 fingerprint-chromium 内核 + Puppeteer 连接
 */

import { app } from 'electron'
import path from 'path'
import puppeteer from './puppeteer.js'
import { launchKernel, checkKernelExists, downloadKernel, resolveKernelVersion, getPlatform } from './kernel'
import { queryGeoInfo } from './utils/proxy'
import { getBrowserInstance, registerBrowser, incrementRef, decrementRef } from './manager'
import { API_CONFIG } from '@/api/config'

/**
 * 打开指纹浏览器实例
 */
export const openBrowser = async (env = null, options = {}) => {
  const { headless = false, proxy: optionProxy, extraArgs = [] } = options

  // 已打开则复用现有连接，创建独立 BrowserContext
  if (env?.id) {
    const existing = getBrowserInstance(env.id)
    if (existing) {
      incrementRef(env.id)
      const browser = await puppeteer.connect({
        browserWSEndpoint: existing.wsEndpoint,
        defaultViewport: null
      })
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      return {
        page,
        close: async () => {
          try { await context.close() } catch (_) {}
          try { browser.disconnect() } catch (_) {}
          await decrementRef(env.id)
        }
      }
    }
  }

  const proxy = optionProxy || env?.proxy_url || ''

  let geoInfo = null
  if (proxy) {
    geoInfo = await queryGeoInfo(proxy, API_CONFIG.BASE_URL)
    if (!geoInfo) throw new Error('代理检测失败')
  }

  const majorVersion = env?.kernel_id
  if (!majorVersion) throw new Error('浏览器配置未设置内核版本')

  const platform = getPlatform()
  const kernel = await resolveKernelVersion(API_CONFIG.BASE_URL, majorVersion, platform)
  if (!kernel) throw new Error(`当前平台无可用 Chrome ${majorVersion} 内核`)

  if (!checkKernelExists(kernel.platform, kernel.version)) {
    await downloadKernel(kernel, (pct, msg) => console.log(`下载: ${(pct * 100).toFixed(0)}%`))
  }

  const fingerprintSeed = env?.fingerprint?.seed || Math.floor(Math.random() * 2147483647) + 1

  const userDataDir = env?.id ? path.join(app.getPath('userData'), 'env-sessions', String(env.id)) : undefined

  const instance = await launchKernel({
    platform: kernel.platform, version: kernel.version,
    proxy, fingerprintSeed, headless,
    timezone: geoInfo?.timeZone || env?.timezone || '',
    lang: geoInfo?.language || 'en-US', userDataDir,
    extraArgs: ['--no-restore-session-state', '--disable-session-crashed-bubble', ...extraArgs]
  })

  if (env?.id) {
    registerBrowser(env.id, instance, null)
    incrementRef(env.id)
  }

  const browser = await puppeteer.connect({ browserWSEndpoint: instance.wsEndpoint, defaultViewport: null })

  const pages = await browser.pages()
  for (let i = 1; i < pages.length; i++) try { await pages[i].close() } catch (_) {}
  const page = pages[0] || await browser.newPage()

  const close = async () => {
    try { await page.close() } catch (_) {}
    try { browser.disconnect() } catch (_) {}
    if (env?.id) await decrementRef(env.id)
  }

  return { page, close }
}
