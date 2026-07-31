/**
 * @file: 行插入节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
const execute = async (node, context) => {
  try {
    const { type, rowIndex } = node.config
    const { worksheet } = node.inputs
    const { complete } = context
    let _rowIndex = rowIndex
    if (type === 'append') {
      _rowIndex = worksheet.rowCount + 1
    }
    worksheet.insertRow(_rowIndex, [])
    complete({
      rowIndex: _rowIndex,
      rowCount: worksheet.rowCount
    })
  } catch (error) {
    throw error
  }
}

export default execute
