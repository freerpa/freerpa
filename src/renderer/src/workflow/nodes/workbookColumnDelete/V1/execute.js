/**
 * @file: 列删除节点执行器
 */
const execute = async (node, context) => {
  
  let { columnIndex, order } = node.config
  const { worksheet } = node.inputs
  const { complete } = context
  if (order == 'desc') {
    columnIndex = worksheet.columnCount - columnIndex + 1
  }
  worksheet.spliceColumns(columnIndex, 1, [])
  complete({
    columnCount: worksheet.columnCount
  })

}

export default execute
