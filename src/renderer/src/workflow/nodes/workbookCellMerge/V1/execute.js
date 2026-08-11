/**
 * @file: 合并单元格节点执行器
 */

const execute = async (node, context) => {
  
  let { startCell, endCell } = node.config
  const { worksheet } = node.inputs
  const { complete } = context
  worksheet.mergeCells(`${worksheet.utils.getColumnLetter(startCell.columnIndex)}${startCell.rowIndex}:${worksheet.utils.getColumnLetter(endCell.columnIndex)}${endCell.rowIndex}`);
  complete({
    rowIndex: startCell.rowIndex,
    columnIndex: startCell.columnIndex
  })

}

export default execute
