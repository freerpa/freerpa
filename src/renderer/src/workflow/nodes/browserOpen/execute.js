/**
 * @file: 打开浏览器节点执行器
 * @author: dabao / FreeRPA
 */

import { openBrowser, puppeteer } from '@/common'

const execute = async (node, context) => {
  const { browser = 'automan' } = node.config
  try {
    if (browser === 'automan') {
      await automanBrowser(node, context)
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
    envId, proxyUrl, launchOptions,
    script, extraArgs
  } = node.config

  let env = {
    storage: {},
    cookies: []
  }

  if (envId) {
    env = await apis.getBrowserDetail(envId) || env
  }
  const headless = launchOptions.includes('--headless=new')
  try {
    const { page, close: closeBrowser } = await openBrowser(env, {
      headless,
      proxy: proxyUrl,
      extraArgs: [...extraArgs, ...launchOptions.filter(arg => arg !== '--custom-arg')]
    })

    // 注入脚本
    if (script) {
      await page.evaluateOnNewDocument(script)
    }

    // 禁止下载
    try {
      await page._client().send('Page.setDownloadBehavior', { behavior: 'deny' })
    } catch (_) { }

    next({ page })

    onBeforeDestroy(async () => {
      try { await closeBrowser() } catch (_) { }
    })
  } catch (error) {
    throw error
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
      try { if (!global.opendCdpBrowser.includes(p.target()._targetId)) await p.close() } catch (_) { }
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
