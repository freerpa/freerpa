/**
 * @file: 列插入节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
const execute = async (node, context) => {
  try {
    const { type, columnIndex } = node.config
    const { worksheet } = node.inputs
    const { complete } = context
    let _columnIndex = columnIndex
    if (type === 'append') {
      _columnIndex = worksheet.columnCount + 1
    }
    worksheet.spliceColumns(_columnIndex, 0, [])
    console.log('worksheet',worksheet.columnCount);
    complete({
      columnIndex: _columnIndex,
      columnCount: worksheet.columnCount
    })
  } catch (error) {
    throw error
  }
}

export default execute
