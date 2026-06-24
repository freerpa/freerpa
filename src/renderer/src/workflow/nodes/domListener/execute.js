/**
 * @file: DOM监听节点执行器
 * @author: dabao
 * @date: 2024-03-15
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

  try {
    const { selector, type = 'exists', interval = 1000, isContinuous = true } = config

    // 获取元素状态
    const getElementState = async () => {
      const element = await page.$(selector)
      if (!element) return false
      switch (type) {
        case 'exists':
          return !!element
        case 'notExists':
          return !element
        case 'visible': {
          return element.isVisible()
        }
        case 'notVisible': {
          return element.isHidden()
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
          return attrs
        }
        case 'position': {
          if (!element) return null
          const rect = await page_eval(element, `(el) => el.getBoundingClientRect().toJSON()`)
          return {
            x: rect.x,
            y: rect.y,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
          }
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
          return {
            width: rect.width,
            height: rect.height,
            offsetWidth: rect.offsetWidth,
            offsetHeight: rect.offsetHeight,
            clientWidth: rect.clientWidth,
            clientHeight: rect.clientHeight
          }
        }
        case 'content': {
          if (!element) return null
          const text = await page_eval(element, `(el) => el.innerText?.trim()`)
          return text
        }
        case 'html': {
          if (!element) return null
          const html = await page_eval(element, `(el) => el.innerHTML?.trim()`)
          return html
        }
        case 'value': {
          if (!element) return null
          const value = await page_eval(element, `(el) => el.value || ''`)
          console.log('value', value)
          return value
        }
        case 'childNodes': {
          if (!element) return null
          const childNodes = await page_eval(element, `(el) => el.childNodes.length`)
          return childNodes
        }
        default:
          return null
      }
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
  } catch (error) {
    throw error
  }
}

export default execute
