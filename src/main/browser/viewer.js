/**
 * @file: 打开指纹浏览器
 * @author: FreeRPA
 *
 * openBrowser — 按浏览器配置启动 fingerprint-chromium 内核 + Puppeteer 连接
 */

import { app } from 'electron'
import path from 'path'
import puppeteer from 'puppeteer-core'
import { launchKernel, checkKernelExists, downloadKernel, resolveKernelVersion, getPlatform } from './kernel'
import { queryGeoInfo } from './utils/proxy'
import { API_CONFIG } from '@/api/config'

/**
 * 打开指纹浏览器实例
 *
 * @param {object} env - 浏览器配置 { id, kernel_id, proxy_url, storage, cookies, timezone, fingerprint }
 * @param {object} options - { headless, proxy, extraArgs }，proxy 优先级高于 env.proxy_url
 * @returns {Promise<{ page: object, browser: object, close: function }>}
 */
export const openBrowser = async (env = null, options = {}) => {
  const { headless = false, proxy: optionProxy, extraArgs = [] } = options

  // 代理：节点配置 > 环境配置
  const proxy = optionProxy || env?.proxy_url || ''

  // 有代理时：查询代理 IP 地理信息（用于设置时区、语言），失败则禁止打开
  let geoInfo = null
  if (proxy) {
    geoInfo = await queryGeoInfo(proxy, API_CONFIG.BASE_URL)
    if (!geoInfo) throw new Error('代理检测失败，请检查代理地址是否有效')
  }

  // 通过主版本号解析完整内核版本
  const majorVersion = env?.kernel_id
  if (!majorVersion) throw new Error('浏览器配置未设置内核版本（kernel_id）')

  const platform = getPlatform()
  const kernel = await resolveKernelVersion(API_CONFIG.BASE_URL, majorVersion, platform)
  if (!kernel) throw new Error(`当前平台 (${platform}) 没有可用的 Chrome ${majorVersion} 内核`)

  // 检查并下载内核
  if (!checkKernelExists(kernel.platform, kernel.version)) {
    console.log(`内核不存在，开始下载: ${kernel.platform}/${kernel.version}`)
    await downloadKernel(kernel, (percent, msg) => {
      console.log(`下载进度: ${(percent * 100).toFixed(0)}% - ${msg}`)
    })
    console.log('内核下载完成')
  }

  // 指纹种子：使用已存储的或生成新的
  const fingerprintSeed = env?.fingerprint?.seed
    || Math.floor(Math.random() * 2147483647) + 1

  // Session 目录：持久化到 env-sessions 下，按浏览器 ID 隔离
  const userDataDir = env?.id
    ? path.join(app.getPath('userData'), 'env-sessions', String(env.id))
    : undefined

  const instance = await launchKernel({
    platform: kernel.platform,
    version: kernel.version,
    proxy,
    fingerprintSeed,
    headless,
    timezone: geoInfo?.timeZone || env?.timezone || '',
    lang: geoInfo?.language || 'en-US',
    userDataDir,
    extraArgs: [
      '--no-restore-session-state',
      '--disable-session-crashed-bubble',
      ...extraArgs
    ]
  })

  const browser = await puppeteer.connect({
    browserWSEndpoint: instance.wsEndpoint,
    defaultViewport: null
  })

  const pages = await browser.pages()
  const page = pages[0] || await browser.newPage()

  // 恢复 storage
  if (env?.storage) {
    try {
      await page.evaluate((storage) => {
        Object.entries(storage.localStorage || {}).forEach(([key, value]) => localStorage.setItem(key, value))
        Object.entries(storage.sessionStorage || {}).forEach(([key, value]) => sessionStorage.setItem(key, value))
      }, env.storage)
    } catch (e) { console.warn('恢复 storage 失败:', e.message) }
  }

  // 恢复 cookies
  if (env?.cookies?.length) {
    try { await page.setCookie(...env.cookies) } catch (e) { console.warn('恢复 cookies 失败:', e.message) }
  }

  const close = async () => {
    try {
      const proc = instance.process
      if (process.platform === 'win32') {
        const { execSync } = await import('child_process')
        execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: 'ignore' })
      } else {
        proc.kill('SIGTERM')
        setTimeout(() => { try { proc.kill('SIGKILL') } catch (_) {} }, 5000)
      }
    } catch (_) {}
  }

  return { page, browser, close }
}
