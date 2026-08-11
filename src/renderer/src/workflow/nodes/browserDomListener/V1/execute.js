/**
 * @file: DOM监听节点执行器
 */

import { page_eval } from '@pageEval'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { next, complete, onBeforeDestroy } = context
  const page = inputs.page
  let isDestroy = false

  // 监听节点销毁
  onBeforeDestroy(() => {
    isDestroy = true
  })

  
  const { selector, types = [], interval = 1000, isContinuous = true } = config

  // 获取元素状态
  const getElementState = async () => {
    const element = await page.find(selector)
    if (!element) return false
    const state = {}
    for (const type of types) {
      switch (type) {
        case 'exists':
          state.exists = !!element
          break
        case 'notExists':
          state.notExists = !element
          break
        case 'visible': {
          state.visible = await element.isVisible()
          break
        }
        case 'notVisible': {
          state.notVisible = await element.isHidden()
          break
        }
        case 'inViewport': {
          const isIntersectingViewport = await element.isIntersectingViewport()
          state.inViewport = isIntersectingViewport
          break
        }
        case 'notInViewport': {
          const isIntersectingViewport = await element.isIntersectingViewport()
          state.notInViewport = !isIntersectingViewport
          break
        }
        case 'attributes': {
          if (!element) return null
          const attrs = await page_eval(
            element,
            `(el) => {
              const attrs = {}
              for (const attr of el.attributes) {
                attrs[attr.name] = attr.value
              }
              return attrs
            }`
          )
          state.attributes = attrs
          break
        }
        case 'position': {
          if (!element) return null
          const rect = await page_eval(element, `(el) => el.getBoundingClientRect().toJSON()`)
          state.position = {
            x: rect.x,
            y: rect.y,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
          }
          break
        }
        case 'size': {
          if (!element) return null
          const rect = await page_eval(
            element,
            `(el) => {
          const rect = el.getBoundingClientRect().toJSON()
          return {
            ...rect,
            offsetWidth: el.offsetWidth,
            offsetHeight: el.offsetHeight,
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight
          }
        }`
          )
          state.size = {
            width: rect.width,
            height: rect.height,
            offsetWidth: rect.offsetWidth,
            offsetHeight: rect.offsetHeight,
            clientWidth: rect.clientWidth,
            clientHeight: rect.clientHeight
          }
          break
        }
        case 'content': {
          if (!element) return null
          const text = await page_eval(element, `(el) => el.innerText?.trim()`)
          state.content = text
          break
        }
        case 'html': {
          if (!element) return null
          const html = await page_eval(element, `(el) => el.innerHTML?.trim()`)
          state.html = html
          break
        }
        case 'value': {
          if (!element) return null
          const value = await page_eval(element, `(el) => el.value || ''`)
          state.value = value
          break
        }
        case 'childNodes': {
          if (!element) return null
          const childNodes = await page_eval(element, `(el) => el.childNodes.length`)
          state.childNodes = childNodes
          break
        }
      }
    }
    return state
  }

  // 检查状态是否变化
  const checkStateChange = (oldState, newState) => {
    if (oldState === null || newState === null) {
      return oldState !== newState
    }

    if (typeof oldState !== typeof newState) {
      return true
    }

    if (typeof oldState === 'boolean') {
      return oldState !== newState
    }

    // 对象比较
    if (typeof oldState === 'object') {
      const oldKeys = Object.keys(oldState)
      const newKeys = Object.keys(newState)

      if (oldKeys.length !== newKeys.length) {
        return true
      }

      return oldKeys.some((key) => {
        const oldVal = oldState[key]
        const newVal = newState[key]

        if (typeof oldVal === 'object' && oldVal !== null) {
          return checkStateChange(oldVal, newVal)
        }

        return oldVal !== newVal
      })
    }

    return oldState !== newState
  }

  let lastState = false
  //定时检查函数
  const checkState = async () => {
    // 如果节点被销毁，则停止检查
    if (isDestroy) {
      return
    }
    const currentState = await getElementState().catch(() => false)
    // 检查状态是否变化
    if (checkStateChange(lastState, currentState) && currentState) {
      if (isContinuous) {
        // 状态变化时执行下一步
        next()
        await new Promise((resolve) => setTimeout(resolve, interval))
        checkState()
      } else {
        complete()
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, interval))
      checkState()
    }
    lastState = currentState
  }
  checkState()

}

export default execute
