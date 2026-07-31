/**
 * @file: 工作薄保存节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import path from 'path'
const execute = async (node, context) => {
  try {
    const { filePath, fileName, overwrite } = node.config
    const { worksheet } = node.inputs
    const { complete, fs } = context
    const _filePath = path.join(filePath, fileName + ".xlsx")
    const realPath = path.join(fs.realpathSync(filePath), fileName + ".xlsx")
    await worksheet._workbook.xlsx.writeFile(realPath)
    complete({
      filePath: _filePath
    })
  } catch (error) {
    throw error
  }
}

export default execute
