/**
 * @file: 取消合并单元格节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  try {
    let { rowIndex, columnIndex } = node.config
    const { worksheet } = node.inputs
    const { complete } = context
    worksheet.unMergeCells(`${worksheet.utils.getColumnLetter(columnIndex)}${rowIndex}`);
    complete()
  } catch (error) {
    throw error
  }
}

export default execute
