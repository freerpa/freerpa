/**
 * @file: 打开指纹浏览器
 * @author: FreeRPA
 *
 * openBrowser — 启动 fingerprint-chromium 内核 + Puppeteer 连接
 */

import puppeteer from 'puppeteer-core'
import { launchKernel, fetchKernelList, checkKernelExists, downloadKernel } from './kernel'

/**
 * 打开指纹浏览器实例
 *
 * @param {object} env - 浏览器数据（可选，用于 storage/cookies 恢复）
 * @param {object} options - { headless, proxy }
 * @returns {Promise<{ page: object, browser: object, close: function }>}
 */
export const openBrowser = async (env = null, options = {}) => {
  const { headless = false, proxy = '' } = options

  const baseUrl = process.env.NODE_ENV === 'development'
    ? process.env.VITE_DEV_URL || 'http://127.0.0.1:8787'
    : process.env.VITE_PROD_URL || 'https://api.automan.site'

  const kernelList = await fetchKernelList(baseUrl)
  if (!kernelList || kernelList.length === 0) {
    throw new Error('没有可用的内核，请在管理后台添加内核')
  }

  const kernel = kernelList[0]

  if (!checkKernelExists(kernel.platform, kernel.version)) {
    console.log(`内核不存在，开始下载: ${kernel.platform}/${kernel.version}`)
    await downloadKernel(kernel, (percent, msg) => {
      console.log(`下载进度: ${(percent * 100).toFixed(0)}% - ${msg}`)
    })
    console.log('内核下载完成')
  }

  const instance = await launchKernel({
    platform: kernel.platform,
    version: kernel.version,
    proxy,
    fingerprintSeed: Math.floor(Math.random() * 100000),
    headless,
    timezone: env?.timezone || '',
    lang: 'en-US'
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
