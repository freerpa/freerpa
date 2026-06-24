/**
 * @file: 合并单元格节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  try {
    let { startCell, endCell } = node.config
    const { worksheet } = node.inputs
    const { complete } = context
    worksheet.mergeCells(`${worksheet.utils.getColumnLetter(startCell.columnIndex)}${startCell.rowIndex}:${worksheet.utils.getColumnLetter(endCell.columnIndex)}${endCell.rowIndex}`);
    complete({
      rowIndex: startCell.rowIndex,
      columnIndex: startCell.columnIndex
    })
  } catch (error) {
    throw error
  }
}

export default execute
