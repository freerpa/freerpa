/**
 * @file: 列删除节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
const execute = async (node, context) => {
  try {
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
  } catch (error) {
    throw error
  }
}

export default execute
