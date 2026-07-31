/**
 * @file: 保存PDF节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import path from 'path'
import { page_eval } from '@pageEval'
const execute = async (node, context) => {
  const {
    excludes = [],
    filePath = '',
    fileName = ''
  } = node.config
  const page = node.inputs.page
  const { complete, fs } = context
  try {
    const _filePath = path.join(filePath, fileName + ".pdf")
    const realPath = path.join(fs.realpathSync(filePath), fileName + ".pdf")
    for (const exclude of excludes) {
      try {
        const element = await page.find(exclude.selector)
        if (element) await page_eval(element, `el => el.remove()`)
      } catch (error) {
        console.log(error)
      }
    }
    await page.pdf({
      path: realPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        bottom: '1cm',
        left: '1cm',
        right: '1cm'
      }
    })
    complete({
      filePath: _filePath
    })

  } catch (error) {
    throw error
  }
}
export default execute
