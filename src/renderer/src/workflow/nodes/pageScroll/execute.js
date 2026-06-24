/**
 * @file: 页面滚动节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import { page_eval } from '@pageEval'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  const behavior = config.behavior || 'smooth'

  try {
    const page = inputs.page
    const { scrollType, scrollArea, selector } = config

    if (scrollArea) {
      await page.waitForSelector(scrollArea)
    } else {
      await page.waitForSelector('body')
    }
    if (selector) {
      await page.waitForSelector(selector)
    }

    // 滚动到指定元素
    if (scrollType === 'element' && selector) {
      const element = await page.$(selector)
      if (!element) {
        throw new Error(`未找到目标元素: ${selector}`)
      }

      // 使用内置的scrollIntoView方法
      element.scrollIntoView({
        behavior: behavior,
        block: 'center',
        inline: 'center'
      })
    }
    // 滚动到指定位置
    else if (scrollType === 'position') {
      const { x = 0, y = 0, relative = false } = config.position || {}

      if (scrollArea) {
        await page_eval(
          page,
          `(selector, x, y, relative, behavior) => {
            const element = document.querySelector(selector)
            if (element) {
              if (relative) {
                // 相对滚动
                element.scrollTo({
                  left: element.scrollLeft + x,
                  top: element.scrollTop + y,
                  behavior: behavior
                })
              } else {
                // 绝对滚动
                element.scrollTo({
                  left: x,
                  top: y,
                  behavior: behavior
                })
              }
            }
          }`,
          scrollArea,
          x,
          y,
          relative,
          behavior
        )
      } else {
          await page_eval(
          page,
          `(x, y, relative, behavior) => {
            if (relative) {
              // 相对滚动
              window.scrollTo({
                left: window.pageXOffset + x,
                top: window.pageYOffset + y,
                behavior: behavior
              })
            } else {
              // 绝对滚动
              window.scrollTo({
                left: x,
                top: y,
                behavior: behavior
              })
            }
          }`,
          x,
          y,
          relative,
          behavior
        )
      }
    }
    // 滚动到底部
    else if (scrollType === 'bottom') {
      if (scrollArea) {
        await page_eval(
          page,
          `(selector, behavior) => {
            const element = document.querySelector(selector)
            if (element) {
              element.scrollTo({
                left: 0,
                top: element.scrollHeight,
                behavior: behavior
              })
            }
          }`,
          scrollArea,
          behavior
        )
      } else {
        await page_eval(
          page,
          `(behavior) => {
          window.scrollTo({
            left: 0,
            top: document.documentElement.scrollHeight,
            behavior: behavior
          })
        }`,
          behavior
        )
      }
    }
    // 滚动到顶部
    else if (scrollType === 'top') {
      if (scrollArea) {
        await page_eval(
          page,
          `(selector, behavior) => {
            const element = document.querySelector(selector)
            if (element) {
              element.scrollTo({
                left: 0,
                top: 0,
                behavior: behavior
              })
            }
          }`,
          scrollArea,
          behavior
        )
      } else {
        await page_eval(
          page,
          `(behavior) => {
          window.scrollTo({
            left: 0,
            top: 0,
            behavior: behavior
          })
        }`,
          behavior
        )
      }
    }
    // 自动滚动
    else if (scrollType === 'auto') {
      const { direction = 'down', step = 100, interval = 100, duration = 5000 } = config
      let steps = Math.floor(duration / interval)
      if (!duration) {
        steps = 100000
      }

      for (let i = 0; i < steps; i++) {
        await page_eval(
          page,
          `(options, behavior) => {
            const element = options.selector ? document.querySelector(options.selector) : null
            const currentY = element ? element.scrollTop : window.pageYOffset
            const currentX = element ? element.scrollLeft : window.pageXOffset

            let nextX = currentX
            let nextY = currentY

            switch (options.direction) {
              case 'down':
                nextY += options.step
                break
              case 'up':
                nextY = Math.max(0, nextY - options.step)
                break
              case 'right':
                nextX += options.step
                break
              case 'left':
                nextX = Math.max(0, nextX - options.step)
                break
            }

            if (element) {
              element.scrollTo({
                left: nextX,
                top: nextY,
                behavior: behavior
              })
            } else {
              window.scrollTo({
                left: nextX,
                top: nextY,
                behavior: behavior
              })
            }
          }`,
          { direction, step, selector: scrollArea },
          behavior
        )

        await new Promise((resolve) => setTimeout(resolve, interval))
      }
    }

    complete()
  } catch (error) {
    throw error
  }
}

export default execute
