/**
 * @file: 行插入节点执行器
 */
const execute = async (node, context) => {
  
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

}

export default execute
