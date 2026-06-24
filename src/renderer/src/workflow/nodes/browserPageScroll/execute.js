/**
 * @file: 页面滚动节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import { page_eval } from '@pageEval'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, onBeforeDestroy, wait } = context
  const behavior = config.behavior || 'smooth'

  try {
    const page = inputs.page
    const { scrollType, scrollArea } = config
    let scrollAreaElement = null
    if (scrollArea) {
      await page.waitForSelector(scrollArea)
      scrollAreaElement = await page.$(scrollArea)
      if (!scrollAreaElement) {
        throw new Error(`未找到滚动区域: ${scrollArea}`)
      }
    } else {
      await page.waitForSelector('html')
    }

    let isRunning = true
    onBeforeDestroy(() => {
      isRunning = false
    })

    // 滚动到指定元素
    if (scrollType === 'element') {
      const { selector } = config
      if (!selector) {
        throw new Error('目标元素选择器不能为空')
      }
      await page.waitForSelector(selector)
      const element = await page.$(selector)
      if (!element) {
        throw new Error(`未找到目标元素: ${selector}`)
      }
      await page_eval(
        page,
        `(element, behavior) => {
            element.scrollIntoView({
              behavior: behavior,
              block: 'center',
              inline: 'center'
            })
          }`,
        element,
        behavior
      )
    }
    // 滚动到指定位置
    else if (scrollType === 'position') {
      const { x = 0, y = 0, relative = false } = config.position || {}
      await page_eval(
        page,
        `(scrollAreaElement, x, y, relative, behavior) => {
            if (!scrollAreaElement) {
              scrollAreaElement = document.documentElement
            }
            if (relative) {
              scrollAreaElement.scrollTo({
                left: scrollAreaElement.scrollLeft + x,
                top: scrollAreaElement.scrollTop + y,
                behavior: behavior
              })
            } else {
              scrollAreaElement.scrollTo({
                left: x,
                top: y,
                behavior: behavior
              })
            }
          }`,
        scrollAreaElement,
        x,
        y,
        relative,
        behavior
      )
      if (behavior === 'smooth') {
        await wait(800)
      }
    }
    // 滚动到边
    else if (scrollType === 'edge') {
      const { direction } = config
      await page_eval(
        page,
        `(scrollAreaElement, direction, behavior) => {
            if (!scrollAreaElement) {
              scrollAreaElement = document.documentElement
            }
            let scrollLeft = 0
            let scrollTop = 0
            switch (direction) {
              case 'up':
                scrollTop = 0
                break
              case 'down':
                scrollTop = scrollAreaElement.scrollHeight - scrollAreaElement.clientHeight
                break
              case 'left':
                scrollLeft = 0
                break
              case 'right':
                scrollLeft = scrollAreaElement.scrollWidth - scrollAreaElement.clientWidth
                break
            }
            scrollAreaElement.scrollTo({
              left: scrollLeft,
              top: scrollTop,
              behavior: behavior
            })
          }`,
        scrollAreaElement,
        direction,
        behavior
      )
      if (behavior === 'smooth') {
        await wait(800)
      }
    }
    // 持续滚动
    else if (scrollType === 'continuous') {
      const {
        direction = 'down',
        step = 100,
        interval = 100,
        bounce = false,
        stopStrategy = 'duration',
        edgeCount: maxEdgeCount = 2,
        duration = 5000
      } = config

      const startTime = Date.now()
      let currentDirection = direction
      let edgeHitCount = 0

      const reverseDirection = (dir) => {
        switch (dir) {
          case 'down': return 'up'
          case 'up': return 'down'
          case 'right': return 'left'
          case 'left': return 'right'
          default: return dir
        }
      }

      while (isRunning) {
        const elapsed = Date.now() - startTime

        if (stopStrategy === 'duration' && elapsed >= duration) {
          break
        }
        const result = await page_eval(
          page,
          `(direction, step, behavior, scrollAreaElement) => {
            if (!scrollAreaElement) {
              scrollAreaElement = document.documentElement
            }
            const currentY = scrollAreaElement.scrollTop
            const currentX = scrollAreaElement.scrollLeft

            const maxScrollLeft = scrollAreaElement.scrollWidth - scrollAreaElement.clientWidth
            const maxScrollTop = scrollAreaElement.scrollHeight - scrollAreaElement.clientHeight

            let nextX = currentX
            let nextY = currentY
            let hitEdge = false

            switch (direction) {
              case 'down':
                nextY = Math.min(currentY + step, maxScrollTop)
                hitEdge = nextY >= maxScrollTop
                break
              case 'up':
                nextY = Math.max(currentY - step, 0)
                hitEdge = nextY <= 0
                break
              case 'right':
                nextX = Math.min(currentX + step, maxScrollLeft)
                hitEdge = nextX >= maxScrollLeft
                break
              case 'left':
                nextX = Math.max(currentX - options.step, 0)
                hitEdge = nextX <= 0
                break
            }
            scrollAreaElement.scrollTo({
              left: nextX,
              top: nextY,
              behavior: behavior
            })
            return { hitEdge }
          }`,
          currentDirection, step, behavior, scrollAreaElement
        )

        if (result.hitEdge) {
          edgeHitCount++

          if (stopStrategy === 'edgeCount' && edgeHitCount >= maxEdgeCount) {
            break
          }

          if (bounce) {
            currentDirection = reverseDirection(currentDirection)
          }
        }

        await new Promise((resolve) => setTimeout(resolve, interval))
      }
    }

    complete()
  } catch (error) {
    throw error
  }
}

export default execute
