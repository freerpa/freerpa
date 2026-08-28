/**
 * @file: 浏览器元素编辑节点执行器
 * @security: 用户输入（attrName/attrValue/content）一律经 page_eval 参数传递，禁止插值进 JS 源码（防注入）
 *
 * 关键：puppeteer 的 page.evaluate 对数组参数不做 ElementHandle 递归转换（convertArgument 仅识别单个 handle），
 * 因此不能把 page.find({all:true}) 返回的 handle 数组整体传入——必须逐个 handle 调用 page_eval（单 handle 会被解析为 DOM 元素）。
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
  // 逐个 handle 执行（数组整体传 evaluate 会使 handle 序列化为普通对象，DOM 方法不可用）
  const applyToAll = (code, ...args) => Promise.all(elements.map((el) => page_eval(el, code, ...args)))
  switch (type) {
    case 'appendAttrValue':
      await applyToAll(
        `(element, attrName, attrValue) => {
          const attrValues = (element.getAttribute(attrName) || '').trim().split(' ')
          if (attrValues.includes(attrValue)) {
            return
          } else {
            attrValues.push(attrValue)
            element.setAttribute(attrName, attrValues.join(' '))
          }
        }`,
        attrName,
        attrValue
      )
      break
    case 'removeAttrValue':
      await applyToAll(
        `(element, attrName, attrValue) => {
          const attrValues = (element.getAttribute(attrName) || '').trim().split(' ')
          const index = attrValues.indexOf(attrValue)
          if (index > -1) {
            attrValues.splice(index, 1)
            element.setAttribute(attrName, attrValues.join(' '))
          }
        }`,
        attrName,
        attrValue
      )
      break
    case 'modifyAttrValue':
    case 'addAttribute':
      await applyToAll(
        `(element, attrName, attrValue) => {
          element.setAttribute(attrName, attrValue)
        }`,
        attrName,
        attrValue
      )
      break
    case 'deleteAttribute':
      await applyToAll(
        `(element, attrName) => {
          element.removeAttribute(attrName)
        }`,
        attrName
      )
      break
    case 'deleteElement':
      await applyToAll(
        `(element) => {
          element.remove()
        }`
      )
      break
    case 'modifyContent':
      await applyToAll(
        `(element, content) => {
          element.innerText = content
        }`,
        content
      )
      break
  }
  complete()
}

export default execute
