/**
 * @file: 列插入节点执行器
 */
const execute = async (node, context) => {
  
  const { type, columnIndex } = node.config
  const { worksheet } = node.inputs
  const { complete } = context
  let _columnIndex = columnIndex
  if (type === 'append') {
    _columnIndex = worksheet.columnCount + 1
  }
  worksheet.spliceColumns(_columnIndex, 0, [])
  console.error('worksheet',worksheet.columnCount);
  complete({
    columnIndex: _columnIndex,
    columnCount: worksheet.columnCount
  })

}

export default execute
