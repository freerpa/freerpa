/**
 * @file: 浏览器节点执行器
 * @author: dabao / FreeRPA
 * @date: 2024-03-15
 *
 * 同时支持：
 *  - 原有 WebContentsView（兼容模式）
 *  - fingerprint-chromium 新引擎（自动检测，不改节点接口）
 */
const execute = async (node, context) => {
  const {
    browser = 'automan'
  } = node.config
  try {
    if (browser === 'automan') {
      await automanBrowser(node, context)
    } else if (browser === 'bit') {
      await bitBrowser(node, context)
    } else if (browser === 'cdp') {
      await cdpBrowser(node, context)
    }
  } catch (error) {
    throw error
  }
}

export default execute

/**
 * @file: automan浏览器节点执行器（fingerprint-chromium 兼容版）
 * @author: dabao / FreeRPA
 * @date: 2024-03-15
 */

import { BaseWindow } from 'electron'
import { createEnvView } from '@/common'
import { v4 as uuidv4 } from 'uuid'
import { fullLists, PuppeteerBlocker } from '@ghostery/adblocker-puppeteer'
import fetch from 'cross-fetch'
import { promises as fs } from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-core'

const automanBrowser = async (node, context) => {
  const { next, onBeforeDestroy, apis, wait } = context
  const {
    envId,
    proxyUrl,
    other,
    offscreen,
    browser_type,
    browser_ua,
    browser_width,
    browser_height,
    script
  } = node.config

  // 默认浏览器数据
  let envData = {
    browser_width: browser_width || 1280,
    browser_height: browser_height || 720,
    browser_ua: browser_ua || '',
    browser_type: browser_type || 'pc',
    storage: {},
    cookies: []
  }

  // 如果浏览器ID存在，获取浏览器数据
  if (envId) {
    const env = await apis.getEnvironmentDetail(envId)
    if (env) {
      envData = env
    }
  }

  try {
    // 使用 fingerprint-chromium 创建浏览器
    const view = await createEnvView(envData, {
      offscreen,
      backgroundThrottling: false,
      proxy: proxyUrl,
      nodeId: node.id,
      images: !other.includes('no_image'),
      newPage: other.includes('new_page')
    })

    // ========== 兼容性层 ==========
    // view 可能是:
    //   A) fingerprint-chromium wrapper (有 puppeteerPage 属性)
    //   B) 旧的 WebContentsView (没有 puppeteerPage 属性)
    // 两种都支持

    const isFpKernel = !!view.puppeteerPage

    let window = null
    let page = null

    if (isFpKernel) {
      // ======= fingerprint-chromium 模式 =======
      page = view.puppeteerPage

      // 注入脚本
      if (script) {
        await page.evaluateOnNewDocument(script)
      }

      // 广告拦截
      if (other?.includes('ad_block')) {
        const blocker = await PuppeteerBlocker.fromLists(
          fetch,
          fullLists,
          { enableCompression: true },
          {
            path: path.join(__dirname, '../../engine.bin'),
            read: fs.readFile,
            write: fs.writeFile
          }
        )
        await blocker.enableBlockingInPage(page)
      }

      // 设置静音（fingerprint-chromium 不支持运行时设置）
      // view.webContents.setAudioMuted(other.includes('mute'))
    } else {
      // ======= 旧 WebContentsView 兼容模式 =======
      window = new BaseWindow({
        width: envData.browser_width,
        height: envData.browser_height,
        show: !offscreen,
        closable: false,
        minimizable: false,
        title: node.name,
        roundedCorners: false
      })

      const fitWindow = () => {
        const bounds = window.getContentBounds()
        view.setBounds({
          x: 0,
          y: 0,
          width: bounds.width,
          height: bounds.height
        })
      }

      window.contentView.addChildView(view)
      fitWindow()

      window.on('resize', () => { fitWindow() })
      window.setMenuBarVisibility(false)

      // 设置静音
      view.webContents.setAudioMuted(other?.includes('mute'))

      // chrome://id trick 获取 Puppeteer page
      const id = uuidv4()
      let destroy = false

      page = await new Promise(async (resolve, reject) => {
        view.webContents.once('did-fail-load', async () => {
          if (!global.browser.connected) {
            await global.pptrConnect()
          }
          let p = null
          while (!p && !destroy) {
            const pages = await global.browser.pages()
            p = pages.find((pg) => pg.target().url().includes(id))
            await wait(1000)
          }
          resolve(p)
        })
        view.webContents.loadURL(`chrome://${id}`).catch(() => {})
      })

      // 注入脚本
      if (script) {
        await page.evaluateOnNewDocument(script)
      }

      // 广告拦截
      if (other?.includes('ad_block')) {
        const blocker = await PuppeteerBlocker.fromLists(
          fetch,
          fullLists,
          { enableCompression: true },
          {
            path: path.join(__dirname, '../../engine.bin'),
            read: fs.readFile,
            write: fs.writeFile
          }
        )
        await blocker.enableBlockingInPage(page)
      }
    }

    // ====== 以下代码两种模式共用 ======

    // 设置下载行为
    try {
      await page._client().send('Page.setDownloadBehavior', {
        behavior: 'deny',
      })
    } catch (e) {}

    // 重写 waitForSelector 等方法（支持 iframe）
    const getFinalFrameAndSelector = async (selector) => {
      const isXpath = selector.startsWith('::-p-xpath(')
      let frame = null
      let realSelector = selector
      if (isXpath) {
        realSelector = selector.slice(11, -1)
      }
      if (realSelector.startsWith('---iframe')) {
        const regex = /^---iframe(\d+)--->/
        const matchResult = realSelector.match(regex)
        const frameID = matchResult[1]
        const frameUrl = view.webContents.mainFrame?.framesInSubtree?.find((f) => f.routingId == frameID)?.url
        if (frameUrl) {
          realSelector = realSelector.slice(13 + frameID.length)
          await page.waitForFrame(frameUrl)
          frame = page.frames().find((f) => f.url() === frameUrl)
        }
      }
      if (isXpath) {
        realSelector = `::-p-xpath(${realSelector})`
      }
      return { frame: frame || page.mainFrame(), realSelector }
    }

    page.waitForSelector = async (selector, options = {}) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.waitForSelector(realSelector, options)
    }
    page.select = async (selector) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.select(realSelector)
    }
    page.$eval = async (selector, pageFunction, ...args) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.$eval(realSelector, pageFunction, ...args)
    }
    page.$$eval = async (selector, pageFunction, ...args) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.$$eval(realSelector, pageFunction, ...args)
    }
    page.$ = async (selector) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.$(realSelector)
    }
    page.$$ = async (selector) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.$$(realSelector)
    }
    page.pdf = async (options) => {
      options.pageSize = options.format
      if (isFpKernel && view.webContents.printToPDF) {
        return await view.webContents.printToPDF(options)
      }
      try {
        const data = await view.webContents.printToPDF(options)
        await fs.writeFile(options.path, data)
      } catch (error) {
        throw error
      }
    }

    // 执行下一步
    next({ page })

    // 清理
    const Destroy = async () => {
      try {
        for (const newPage of view.newPages || []) {
          await newPage.close()
        }
        await view.webContents.close()
        if (window) {
          await window.destroy()
        }
      } catch (error) {}
    }

    onBeforeDestroy(Destroy)
  } catch (error) {
    throw error
  }
}

// 比特浏览器（不变）
const bitBrowser = async (node, context) => {
  // ... 保持不变，从原文件复制
  const { next, onBeforeDestroy, wait, global } = context
  const { port, bitWindow, offscreen, script } = node.config

  try {
    const baseUrl = `http://127.0.0.1:${port}`
    const request = async (url, body = null) => {
      const res = await fetch(`${baseUrl}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      return await res.json()
    }

    const openWindow = async () => {
      const args = []
      if (offscreen) args.push('--headless=new')
      const res = await request('/browser/open', { id: bitWindow, queue: true, ignoreDefaultUrls: true, args })
      if (res?.success) {
        const browser = await puppeteer.connect({
          browserWSEndpoint: res?.data?.ws,
          defaultViewport: null
        })
        let page = null
        const pages = await browser.pages()
        if (pages.length > 0 && !global.opendBitBrowser.includes(pages[0].target()._targetId)) {
          page = pages[0]
        } else {
          page = await browser.newPage({ type: 'window' })
        }
        await page.evaluateOnNewDocument(script)
        global.opendBitBrowser.push(page.target()._targetId)
        for (const p of pages) {
          try {
            if (!global.opendBitBrowser.includes(p.target()._targetId)) await p.close()
          } catch (e) {}
        }
        next({ page })
      } else {
        if (res?.msg?.includes('正在打开中')) {
          await wait(500)
          await openWindow()
        } else {
          throw new Error(res?.msg)
        }
      }
    }
    await openWindow()
    const Destroy = async () => {
      global.opendBitBrowser = global.opendBitBrowser.filter(id => id !== page.target()._targetId)
      await page.close()
    }
    onBeforeDestroy(Destroy)
  } catch (error) {
    throw new Error(error?.message || '打开窗口失败,请检查比特浏览器是否已启动')
  }
}

// CDP浏览器（不变）
const cdpBrowser = async (node, context) => {
  const { next, onBeforeDestroy, global } = context
  const { cdpUrl, script } = node.config
  try {
    if (!cdpUrl.startsWith('ws')) throw new Error('CDP连接URL必须以ws开头')
    const browser = await puppeteer.connect({
      browserWSEndpoint: cdpUrl,
      defaultViewport: null
    })
    const pages = await browser.pages()
    let page = null
    if (pages.length > 0 && !global.opendCdpBrowser.includes(pages[0].target()._targetId)) {
      page = pages[0]
    } else {
      page = await browser.newPage({ type: 'window' })
    }
    global.opendCdpBrowser.push(page.target()._targetId)
    for (const p of pages) {
      try {
        if (!global.opendCdpBrowser.includes(p.target()._targetId)) await p.close()
      } catch (e) {}
    }
    await page.evaluateOnNewDocument(script)
    const Destroy = async () => {
      global.opendCdpBrowser = global.opendCdpBrowser.filter(id => id !== page.target()._targetId)
      await page.close()
    }
    onBeforeDestroy(Destroy)
    next({ page })
  } catch (error) {
    throw error
  }
}
