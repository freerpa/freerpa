/**
 * @file: 浏览器节点执行器
 * @author: dabao / FreeRPA
 *
 * 纯 fingerprint-chromium 实现
 */

import { createEnvView } from '@/common'
import { fullLists, PuppeteerBlocker } from '@ghostery/adblocker-puppeteer'
import fetch from 'cross-fetch'
import { promises as fs } from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-core'

const execute = async (node, context) => {
  const { browser = 'automan' } = node.config
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

const automanBrowser = async (node, context) => {
  const { next, onBeforeDestroy, apis } = context
  const {
    envId, proxyUrl, other, offscreen,
    browser_type, browser_ua, browser_width, browser_height, script
  } = node.config

  let envData = {
    browser_width: browser_width || 1280,
    browser_height: browser_height || 720,
    browser_ua: browser_ua || '',
    browser_type: browser_type || 'pc',
    storage: {},
    cookies: []
  }

  if (envId) {
    const env = await apis.getEnvironmentDetail(envId)
    if (env) envData = env
  }

  try {
    const { page } = await createEnvView(envData, {
      offscreen,
      proxy: proxyUrl,
    })

    // 注入脚本
    if (script) {
      await page.evaluateOnNewDocument(script)
    }

    // 广告拦截
    if (other?.includes('ad_block')) {
      const blocker = await PuppeteerBlocker.fromLists(
        fetch, fullLists, { enableCompression: true },
        {
          path: path.join(__dirname, '../../engine.bin'),
          read: fs.readFile, write: fs.writeFile
        }
      )
      await blocker.enableBlockingInPage(page)
    }

    // 设置下载行为
    try {
      await page._client().send('Page.setDownloadBehavior', { behavior: 'deny' })
    } catch (_) {}

    // 重写 waitForSelector 等方法（支持 iframe）
    const getFinalFrameAndSelector = async (selector) => {
      const isXpath = selector.startsWith('::-p-xpath(')
      let frame = null
      let realSelector = selector
      if (isXpath) realSelector = selector.slice(11, -1)

      if (realSelector.startsWith('---iframe')) {
        const matchResult = realSelector.match(/^---iframe(\d+)--->/)
        if (matchResult) {
          const frameID = matchResult[1]
          // fingerprint-chromium: 直接从 page.frames() 查找
          realSelector = realSelector.slice(13 + frameID.length)
          const frames = page.frames()
          frame = frames.find((f) => f.url().includes(`routingId=${frameID}`))
            || frames.find((f) => f !== page.mainFrame())
          if (!frame) frame = page.mainFrame()
        }
      }

      if (isXpath) realSelector = `::-p-xpath(${realSelector})`
      return { frame: frame || page.mainFrame(), realSelector }
    }

    const wrapSelector = (fn) => async (selector, ...args) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return fn.call(frame, realSelector, ...args)
    }

    page.waitForSelector = wrapSelector(page.mainFrame().waitForSelector.bind(page.mainFrame()))
    page.select = wrapSelector(page.mainFrame().select?.bind(page.mainFrame()) || (() => {}))
    page.$eval = wrapSelector(page.mainFrame().$eval.bind(page.mainFrame()))
    page.$$eval = wrapSelector(page.mainFrame().$$eval.bind(page.mainFrame()))
    page.$ = wrapSelector(page.mainFrame().$.bind(page.mainFrame()))
    page.$$ = wrapSelector(page.mainFrame().$$.bind(page.mainFrame()))

    page.pdf = async (options) => {
      const buf = await page.pdf({ ...options, pageSize: options.format })
      await fs.writeFile(options.path, buf)
    }

    next({ page })

    onBeforeDestroy(async () => {
      try { await page.browser().close() } catch (_) {}
    })
  } catch (error) {
    throw error
  }
}

// 比特浏览器
const bitBrowser = async (node, context) => {
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
          try { if (!global.opendBitBrowser.includes(p.target()._targetId)) await p.close() } catch (_) {}
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
    onBeforeDestroy(async () => {
      global.opendBitBrowser = global.opendBitBrowser.filter(id => id !== page.target()._targetId)
      await page.close()
    })
  } catch (error) {
    throw new Error(error?.message || '打开窗口失败,请检查比特浏览器是否已启动')
  }
}

// CDP浏览器
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
      try { if (!global.opendCdpBrowser.includes(p.target()._targetId)) await p.close() } catch (_) {}
    }
    await page.evaluateOnNewDocument(script)
    onBeforeDestroy(async () => {
      global.opendCdpBrowser = global.opendCdpBrowser.filter(id => id !== page.target()._targetId)
      await page.close()
    })
    next({ page })
  } catch (error) {
    throw error
  }
}
