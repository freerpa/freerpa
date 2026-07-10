/**
 * @file: 浏览器元素编辑节点执行器
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
          `(...elements) => {
            for (const element of elements) {
                const attrValues = (element.getAttribute('${attrName}') || '').trim().split(' ')
                if (attrValues.includes('${attrValue}')) {
                  return
                }else{
                  attrValues.push('${attrValue}')
                  element.setAttribute('${attrName}', attrValues.join(' '))
                }
              } 
            }`
          , ...elements
        )
        break
      case 'removeAttrValue':
        await page_eval(
          page,
          `(...elements) => {
              for (const element of elements) {
                const attrValues = (element.getAttribute('${attrName}') || '').trim().split(' ')
                const index = attrValues.indexOf('${attrValue}')
                if (index > -1) {
                  attrValues.splice(index, 1)
                  element.setAttribute('${attrName}', attrValues.join(' '))
                }
              }
            }`
          , ...elements
        )
        break
      case 'modifyAttrValue':
      case 'addAttribute':
        await page_eval(
          page,
          `(...elements) => {
              for (const element of elements) {
                element.setAttribute('${attrName}', '${attrValue}')
              }
            }`, ...elements
        )
        break
      case 'deleteAttribute':
        await page_eval(
          page,
          `(...elements) => {
              elements.forEach(element => {
                element.removeAttribute('${attrName}')
              })
            }`
          , ...elements
        )
        break
      case 'deleteElement':
        await page_eval(
          page,
          `(...elements) => {
              elements.forEach(element => element.remove())
            }`
          , ...elements
        )
        break
      case 'modifyContent':
        await page_eval(
          page,
          `(...elements) => {
              elements.forEach(element => {
                element.innerText = '${content}'
              })
            }`
          , ...elements
        )
        break
    }
    complete()
  } catch (error) {
    throw error
  }
}

export default execute
