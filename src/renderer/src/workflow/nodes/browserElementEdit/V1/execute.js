/**
 * @file: 浏览器元素编辑节点执行器
 * @author: dabao
 * @date: 2024-03-29
 * @security: 用户输入（attrName/attrValue/content）一律经 page_eval 参数传递，禁止插值进 JS 源码（防注入）
 */
import { page_eval } from '@pageEval'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  const page = inputs.page
  const {
    selector,
    type,
    content,
    attrName,
    attrValue,
  } = config

  const elements = await page.find(selector, { all: true })
  if (!elements || elements.length === 0) {
    throw new Error(`未找到元素: ${selector.name}`)
  }
  switch (type) {
    case 'appendAttrValue':
      await page_eval(
        page,
        `(els, attrName, attrValue) => {
          for (const element of els) {
            const attrValues = (element.getAttribute(attrName) || '').trim().split(' ')
            if (attrValues.includes(attrValue)) {
              return
            } else {
              attrValues.push(attrValue)
              element.setAttribute(attrName, attrValues.join(' '))
            }
          }
        }`,
        elements,
        attrName,
        attrValue
      )
      break
    case 'removeAttrValue':
      await page_eval(
        page,
        `(els, attrName, attrValue) => {
          for (const element of els) {
            const attrValues = (element.getAttribute(attrName) || '').trim().split(' ')
            const index = attrValues.indexOf(attrValue)
            if (index > -1) {
              attrValues.splice(index, 1)
              element.setAttribute(attrName, attrValues.join(' '))
            }
          }
        }`,
        elements,
        attrName,
        attrValue
      )
      break
    case 'modifyAttrValue':
    case 'addAttribute':
      await page_eval(
        page,
        `(els, attrName, attrValue) => {
          for (const element of els) {
            element.setAttribute(attrName, attrValue)
          }
        }`,
        elements,
        attrName,
        attrValue
      )
      break
    case 'deleteAttribute':
      await page_eval(
        page,
        `(els, attrName) => {
          for (const element of els) {
            element.removeAttribute(attrName)
          }
        }`,
        elements,
        attrName
      )
      break
    case 'deleteElement':
      await page_eval(
        page,
        `(els) => {
          for (const element of els) {
            element.remove()
          }
        }`,
        elements
      )
      break
    case 'modifyContent':
      await page_eval(
        page,
        `(els, content) => {
          for (const element of els) {
            element.innerText = content
          }
        }`,
        elements,
        content
      )
      break
  }
  complete()
}

export default execute
