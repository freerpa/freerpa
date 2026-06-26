/**
 * @file: 指纹浏览器视图创建
 * @author: FreeRPA
 *
 * createEnvView — 创建指纹浏览器环境视图（替代原有的 WebContentsView）
 */

import { v4 as uuidv4 } from 'uuid'
import puppeteer from 'puppeteer-core'
import { launchKernel, fetchKernelList, checkKernelExists, downloadKernel } from './kernel'
import { createViewWrapper } from './wrapper'
import { setUserAgentOnPage } from './ua'
import { sendToRenderer } from '../workflow/core/utils/rendererUtils'

/**
 * 创建指纹浏览器视图（替代原有的 WebContentsView）
 *
 * @param {object} env - 浏览器数据 { name, browser_type, browser_ua, storage, cookies, kernel_id, proxy_url }
 * @param {object} options - 选项
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

  const kernel = kernelList[0]

  // 检查内核是否已下载
  if (!checkKernelExists(kernel.platform, kernel.version)) {
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

  // 设置 UA
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
