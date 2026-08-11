/**
 * @file: 行删除节点执行器
 */
const execute = async (node, context) => {
  
  let { rowIndex, order } = node.config
  const { worksheet } = node.inputs
  const { complete } = context
  if (order == 'desc') {
    rowIndex = worksheet.rowCount - rowIndex + 1
  }
  worksheet.spliceRows(rowIndex, 1)
  complete({
    rowCount: worksheet.rowCount
  })

}

export default execute
