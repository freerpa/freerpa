/**
 * @file: 元素状态节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */

import { page_eval } from '@pageEval'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  const { page } = inputs
  const { selector } = config

  try {
    let exists = false
    let visible = false
    let inViewport = false
    let rect = null
    const element = await page.$(selector)
    console.log('element', element)
    if (element) {
      // 定义判断元素是否在视口内的函数
      inViewport = await page_eval(
        element,
        `(element) => {
        const rect = element.getBoundingClientRect()
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        )
      }`
      )
      const isIntersectingViewport = await element.boundingBox()
      console.log('inViewport', inViewport, isIntersectingViewport)
      exists = true
      visible = await element.isVisible()
      rect = await element.boundingBox()
    }

    // 返回检查结果
    complete({
      exists,
      visible,
      inViewport,
      rect
    })
  } catch (error) {
    throw new Error(`元素状态检查失败: ${error.message}`)
  }
}

export default execute
