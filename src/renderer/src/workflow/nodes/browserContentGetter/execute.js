/**
 * @file: 内容获取节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import { page_eval } from '@pageEval'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  try {
    const page = inputs.page
    const {
      selector,
      deduplicate = false,
      elementState = ['visible', 'inViewport'],
      getAll = true,
      getType,
      attributeName,
      styleName,
      parseRules = []
    } = config

    // 获取字段内容
    const getFieldContent = async (element, parser) => {
      try {
        // 获取子元素
        // await element.waitForSelector(parser.selector)
        let subElement = element
        if (parser.selector) {
          subElement = await element.$(parser.selector)
        }
        if (!subElement) return ''

        // 根据获取类型返回内容
        switch (parser.getType) {
          case 'text':
            return await page_eval(subElement, `(el) => el.textContent?.trim() || ''`)
          case 'link':
            return await page_eval(subElement, `(el) => {
              if (el.tagName === 'A') return el.href || ''
              const links = []
              el.querySelectorAll('a').forEach(item => {
                links.push(item.href || '')
              })
              if (links.length == 1) {
                return links[0]
              }
              return links
            }`)
          case 'image':
            return await page_eval(subElement, `(el) =>{
              if (el.tagName === 'IMG') return el.src || ''
              const srcs = []
              el.querySelectorAll('img').forEach(item => {
                srcs.push(item.src || '')
              })
              if (srcs.length == 1) {
                return srcs[0]
              }
              return srcs
            }`)
          case 'audio':
            return await page_eval(subElement, `(el) =>{
              if (el.tagName === 'AUDIO') return el.src || ''
              const srcs = []
              el.querySelectorAll('audio').forEach(item => {
                srcs.push(item.src || '')
              })
              if (srcs.length == 1) {
                return srcs[0]
              }
              return srcs
            }`)
          case 'video':
            return await page_eval(subElement, `(el) =>{
              if (el.tagName === 'VIDEO') return el.src || ''
              const srcs = []
              el.querySelectorAll('video').forEach(item => {
                srcs.push(item.src || '')
              })
              if (srcs.length == 1) {
                return srcs[0]
              }
              return srcs
            }`)
          case 'html':
            return await page_eval(subElement, `(el) => el.innerHTML?.trim() || ''`)
          case 'value':
            return await page_eval(subElement, `(el) => el.value || ''`)
          case 'attribute':
            return await page_eval(
              subElement,
              `(el, attr) => el.getAttribute(attr) || ''`,
              parser.attributeName
            )
          case 'style':
            return await page_eval(
              subElement,
              `(el, style) => window.getComputedStyle(el).getPropertyValue(style) || ''`,
              parser.styleName
            )
          case 'position':
            return await page_eval(
              subElement,
              `(el) => {
              const rect = el.getBoundingClientRect()
              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            }`
            )
          default:
            console.warn(`不支持的获取类型: ${parser.getType}`)
            return ''
        }
      } catch (error) {
        console.warn(`获取字段 ${parser.field} 失败:`, error)
        return ''
      }
    }

    // 获取单个元素的内容
    const getElementContent = async (element) => {
      let result = await getFieldContent(element, { getType, attributeName, styleName })
      // 如果解析规则为空，则返回元素的HTML
      if (parseRules.length > 0 && getType == 'html') {
        // 结果对象
        result = {}
        // 遍历解析规则
        for (const parser of parseRules) {
          result[parser.field] = await getFieldContent(element, parser)
        }
      }
      return result
    }

    // 获取元素
    const getElements = async () => {
      try {
        let result = getAll ? [] : ''
        // 获取多个元素
        let elements = await page.$$(selector)

        // 根据元素状态过滤元素
        if (elementState.includes('visible')) {
          elements = elements.filter((element) => element.isVisible())
        }
        if (elementState.includes('inViewport')) {
          const _elements = []
          for (const element of elements) {
            const inViewport = await page_eval(
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
            if (inViewport) {
              _elements.push(element)
            }
          }
          elements = _elements
        }

        if (deduplicate) {
          // 过滤已获取过内容的元素（仅当页元素有效）
          const _elements = []
          for (const element of elements) {
            const isGeted = await page_eval(
              element,
              `(el) => {
              const isGeted = el.getAttribute('automan-geted-content-${node.id}');
              el.setAttribute('automan-geted-content-${node.id}', 'true');
              return isGeted;
            }`
            )
            if (!isGeted) {
              _elements.push(element)
            }
          }
          elements = _elements
        }
        // 如果有元素
        if (elements.length) {
          // 如果不获取所有元素，只获取第一个元素
          if (!getAll) {
            result = await getElementContent(elements[0])
          } else {
            // 获取所有元素的内容
            result = await Promise.all(elements.map(getElementContent))
          }
        }
        return result
      } catch (error) {
        console.error('获取元素失败:', error)
        throw error
      }
    }

    // 等待元素出现
    await page.waitForSelector(selector)

    // 获取内容
    const content = await getElements()

    // 完成执行
    complete({
      content
    })
  } catch (error) {
    throw error
  }
}

export default execute
