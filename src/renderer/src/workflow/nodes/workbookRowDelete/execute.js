/**
 * @file: 行删除节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
const execute = async (node, context) => {
  try {
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
  } catch (error) {
    throw error
  }
}

export default execute
