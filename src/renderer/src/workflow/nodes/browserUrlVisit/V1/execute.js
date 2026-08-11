/**
 * @file: 访问URL节点执行器
 */
import { page_eval } from '@pageEval'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, wait } = context

  
  const { url, waitUntil = 'load', timeout = 30000, action } = config
  const page = inputs.page
  const options = { waitUntil, timeout }
  const pageAction = async ({ action, url, options }) => {
    switch (action) {
      case 'goto':
        await page.goto(url, options)
        break
      case 'download':
        await page_eval(page, `(url) => location.href = url`, url)
        break
      case 'refresh':
        await page.reload(options)
        break
      case 'back':
        await page.goBack()
        break
      case 'forward':
        await page.goForward()
        break
      case 'listen':
        await page.waitForNavigation(options)
        break
      default:
        break
    }
  }
  let finalUrl = url
  //url检测并补全http或https
  if (!url.startsWith('http')) {
    finalUrl = 'http://' + url
  }
  // 等待页面加载完成
  await pageAction({ action, url: finalUrl, options })
  await wait(500)
  // 继续执行
  complete({
    url: page.url()
  })

}

export default execute
