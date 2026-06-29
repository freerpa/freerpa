/**
 * @file: 浏览器截图节点执行器
 * @author: dabao
 * @date: 2024-03-24
 */
import { page_eval } from '@pageEval'
// 执行器
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, wait } = context
  const { screenshotType, selector, area, imageType, quality, otherConfig = [] } = config
  const page = inputs.page
  try {
    if (!page) {
      throw new Error('浏览器不能为空')
    }

    const needHideScrollbar = otherConfig.includes('hideScrollbar')
    const needWaitForAnimations = otherConfig.includes('waitForAnimations')

    // 隐藏滚动条
    await page.addStyleTag({
      content: `
          ::-webkit-scrollbar {
            display: none !important;
          }
          * {
            scrollbar-width: none !important;
          }
        `
    })

    // 等待动画完成
    if (needWaitForAnimations) {
      await page.waitForSelector('body')
      await wait(500)
      await page_eval(
        page,
        `() => {
          return Promise.all(document.getAnimations().map((animation) => animation.finished))
        }`
      )
    }

    // 准备截图选项
    const screenshotOptions = {
      type: imageType,
      encoding: 'base64',
      quality: imageType !== 'png' ? quality : undefined
    }

    // 根据截图类型处理
    switch (screenshotType) {
      case 'fullscreen':
        screenshotOptions.fullPage = true
        break
      case 'element':
        if (!selector) {
          throw new Error('元素选择器不能为空')
        }
        const element = await page.$(selector)
        if (!element) {
          throw new Error('未找到指定元素')
        }
        screenshotOptions.clip = await element.boundingBox()
        break
      case 'area':
        if (!area || !area.width || !area.height) {
          throw new Error('截图区域配置不正确')
        }
        screenshotOptions.clip = {
          x: area.x || 0,
          y: area.y || 0,
          width: area.width,
          height: area.height
        }
        break
      default:
        throw new Error('不支持的截图类型')
    }
    // 执行截图
    let result = await page.screenshot(screenshotOptions)
    // 根据图片格式添加base64头
    if (imageType === 'png') {
      result = `data:image/png;base64,${result}`
    } else if (imageType === 'jpeg') {
      result = `data:image/jpeg;base64,${result}`
    } else if (imageType === 'webp') {
      result = `data:image/webp;base64,${result}`
    }

    complete({
      result
    })
  } catch (error) {
    throw error
  }
}

export default execute
