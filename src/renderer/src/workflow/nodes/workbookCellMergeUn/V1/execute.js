/**
 * @file: 取消合并单元格节点执行器
 */

const execute = async (node, context) => {
  
  let { rowIndex, columnIndex } = node.config
  const { worksheet } = node.inputs
  const { complete } = context
  worksheet.unMergeCells(`${worksheet.utils.getColumnLetter(columnIndex)}${rowIndex}`);
  complete()

}

export default execute
