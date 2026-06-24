/**
 * @file: 浏览器节点执行器
 * @author: dabao
 * @date: 2024-03-15
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
 * @file: automan浏览器节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

import { BaseWindow } from 'electron'
import { createEnvView } from '@/common'
import { v4 as uuidv4 } from 'uuid'
import { fullLists, PuppeteerBlocker } from '@ghostery/adblocker-puppeteer'
import fetch from 'cross-fetch'
import { promises as fs } from 'fs'
import path from 'path'
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

  // 默认环境数据
  let envData = {
    browser_width: browser_width || 1280,
    browser_height: browser_height || 720,
    browser_ua: browser_ua || '',
    browser_type: browser_type || 'pc',
    storage: {},
    cookies: []
  }

  // 如果环境ID存在，获取环境数据
  if (envId) {
    const env = await apis.getEnvironmentDetail(envId)
    if (env) {
      envData = env
    }
  }

  try {
    const view = await createEnvView(envData, {
      offscreen,
      backgroundThrottling: false,
      proxy: proxyUrl,
      nodeId: node.id,
      images: !other.includes('no_image'),
      newPage: other.includes('new_page')
    })

    // view.webContents.openDevTools()
    let window = null
    window = new BaseWindow({
      width: envData.browser_width,
      height: envData.browser_height,
      show: !offscreen,
      closable: false,
      minimizable: false,
      title: node.name,
      roundedCorners: false
    })
    //适应窗口大小
    const fitWindow = () => {
      const bounds = window.getContentBounds()
      view.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height
      })
    }
    // 将视图添加到窗口内容视图
    window.contentView.addChildView(view)
    fitWindow()
    // 监听窗口大小变化
    window.on('resize', () => {
      fitWindow()
    })
    // 隐藏菜单栏
    window.setMenuBarVisibility(false)
    // 设置静音
    view.webContents.setAudioMuted(other.includes('mute'))
    // 创建一个唯一的ID
    const id = uuidv4()
    let destory = false
    const getPage = () => {
      return new Promise(async (resolve, reject) => {
        view.webContents.once('did-fail-load', async () => {
          // 如果浏览器丢失连接，则重新连接
          if (!global.browser.connected) {
            await global.pptrConnect()
          }
          let page = null
          while (!page && !destory) {
            const pages = await global.browser.pages()
            page = pages.find((page) => page.target().url().includes(id))
            await wait(1000)
          }
          resolve(page)
        })
        // 加载URL
        view.webContents.loadURL(`chrome://${id}`).catch(() => { })
      })
    }
    const page = await getPage()
    // 注入脚本
    await page.evaluateOnNewDocument(script)
    // 设置下载行为
    await page._client().send('Page.setDownloadBehavior', {
      // 禁止下载
      behavior: 'deny',
    })
    //规避法律风险，离屏模式下打开广告拦截
    if (other.includes('ad_block')) {
      const blocker = await PuppeteerBlocker.fromLists(
        fetch,
        fullLists,
        {
          enableCompression: true
        },
        {
          path: path.join(__dirname, '../../engine.bin'),
          read: fs.readFile,
          write: fs.writeFile
        }
      )
      await blocker.enableBlockingInPage(page)
    }

    const getFinalFrameAndSelector = async (selector) => {
      const isXpath = selector.startsWith('::-p-xpath(')
      let frame = null
      let realSelector = selector
      //获取xpath选择器中的实际选择器
      if (isXpath) {
        realSelector = selector.slice(11, -1)
      }
      // 处理iframe选择器
      if (realSelector.startsWith('---iframe')) {
        const regex = /^---iframe(\d+)--->/;
        const matchResult = realSelector.match(regex);
        // 捕获组索引1的内容就是数字（字符串类型）
        const frameID = matchResult[1];
        const frameUrl = view.webContents.mainFrame.framesInSubtree.find((f) => f.routingId == frameID).url
        realSelector = realSelector.slice(13 + frameID.length)
        await page.waitForFrame(frameUrl)
        frame = page.frames().find((f) => f.url() === frameUrl)
      }
      // 复原xpath选择器
      if (isXpath) {
        realSelector = `::-p-xpath(${realSelector})`
      }
      return { frame: frame || page.mainFrame(), realSelector }
    }
    // 重写waitForSelector方法，正确处理子框架中的元素
    page.waitForSelector = async (selector, options = {}) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.waitForSelector(realSelector, options);
    }
    // 重写select方法，正确处理子框架中的元素
    page.select = async (selector) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.select(realSelector);
    }
    // 重写$eval方法，正确处理子框架中的元素
    page.$eval = async (selector, pageFunction, ...args) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.$eval(realSelector, pageFunction, ...args);
    }
    // 重写$$eval方法，正确处理子框架中的元素
    page.$$eval = async (selector, pageFunction, ...args) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.$$eval(realSelector, pageFunction, ...args);
    }
    // 重写$方法，正确处理子框架中的元素
    page.$ = async (selector) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.$(realSelector);
    }
    // 重写$$方法，正确处理子框架中的元素
    page.$$ = async (selector) => {
      const { frame, realSelector } = await getFinalFrameAndSelector(selector)
      return await frame.$$(realSelector);
    }
    // 重写pdf方法，electron 无法正确调用page.pdf API
    page.pdf = async (options) => {
      console.log(options)
      options.pageSize = options.format
      await view.webContents.printToPDF(options).then((data) => {
        fs.writeFile(options.path, data, (error) => {
          if (error) throw error
          console.log(`Wrote PDF successfully to ${options.path}`)
        })
      }).catch((error) => {
        throw error
      })
    }
    //执行下一步
    next({ page })
    // 清理
    const Destroy = async () => {
      try {
        // 关闭新打开的页面
        for (const newPage of view.newPages) {
          await newPage.close()
        }
        await view.webContents.close()
        window && await window.destroy()
      } catch (error) {
        // console.error('清理失败:', error)
      }
    }

    // 在节点销毁前执行清理
    onBeforeDestroy(Destroy)
  } catch (error) {
    throw error
  }
}

import puppeteer from 'puppeteer-core';
// 比特浏览器
const bitBrowser = async (node, context) => {
  const { next, onBeforeDestroy, wait, global } = context
  const {
    port,
    bitWindow,
    offscreen,
    script
  } = node.config

  try {
    const baseUrl = `http://127.0.0.1:${port}`
    const request = async (url, body = null) => {
      try {
        const res = await fetch(`${baseUrl}${url}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        })
        return await res.json()
      } catch (error) {
        throw error
      }
    }
    const openWindow = async () => {
      try {
        const args = []
        if (offscreen) {
          args.push('--headless=new')
        }
        const res = await request('/browser/open',
          {
            id: bitWindow,
            queue: true,
            ignoreDefaultUrls: true,
            args: args
          }
        )
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
            // 创建一个新页面
            page = await browser.newPage({
              type: 'window'
            })
          }
          // 注入脚本
          await page.evaluateOnNewDocument(script)
          global.opendBitBrowser.push(page.target()._targetId)
          // 关闭非本软件打开的页面
          for (const page of pages) {
            try {
              if (!global.opendBitBrowser.includes(page.target()._targetId)) {
                await page.close()
              }
            } catch (error) {
              console.error('关闭页面失败:', error)
            }
          }

          next({
            page
          })
        } else {
          if (res?.msg?.includes('正在打开中')) {
            await wait(500)
            await openWindow()
          } else {
            throw new Error(res?.msg)
          }
        }
      } catch (error) {
        throw new Error(error?.message || '打开窗口失败,请检查比特浏览器是否已启动')
      }
    }
    await openWindow()
    const Destroy = async () => {
      try {
        global.opendBitBrowser = global.opendBitBrowser.filter(id => id !== page.target()._targetId)
        await page.close()
      } catch (error) {
        // console.error('清理失败:', error)
      }
    }
    // 在节点销毁前执行清理
    onBeforeDestroy(Destroy)
  } catch (error) {
    throw error
  }
}

//cdp浏览器
const cdpBrowser = async (node, context) => {
  const { next, onBeforeDestroy, global } = context
  const {
    cdpUrl,
    script
  } = node.config
  try {
    if (!cdpUrl.startsWith('ws')) {
      throw new Error('CDP连接URL必须以ws开头')
    }
    const browser = await puppeteer.connect({
      browserWSEndpoint: cdpUrl,
      defaultViewport: null
    })
    const pages = await browser.pages()
    let page = null
    if (pages.length > 0 && !global.opendCdpBrowser.includes(pages[0].target()._targetId)) {
      page = pages[0]
    } else {
      // 创建一个新页面
      page = await browser.newPage({
        type: 'window'
      })
    }
    global.opendCdpBrowser.push(page.target()._targetId)
    // 关闭非本软件打开的页面
    for (const page of pages) {
      try {
        if (!global.opendCdpBrowser.includes(page.target()._targetId)) {
          await page.close()
        }
      } catch (error) {
        console.error('关闭页面失败:', error)
      }
    }
    // 注入脚本
    await page.evaluateOnNewDocument(script)
    const Destroy = async () => {
      try {
        global.opendCdpBrowser = global.opendCdpBrowser.filter(id => id !== page.target()._targetId)
        await page.close()
      } catch (error) {
        // console.error('清理失败:', error)
      }
    }
    // 在节点销毁前执行清理
    onBeforeDestroy(Destroy)
    next({
      page
    })
  } catch (error) {
    throw error
  }
}