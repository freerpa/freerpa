/**
 * @file: 工作表单元格写入节点执行器
 */
const execute = async (node, context) => {
  /**
     * @description: 获取列号 AA、AB 等
     * @param {number} columnIndex 列号索引
     * @return {string} 列号
     */
  const getColumnLetter = (columnIndex) => {
    let columnLetter = ''
    while (columnIndex > 0) {
      const charIndex = (columnIndex - 1) % 26
      columnLetter = String.fromCharCode(charIndex + 'A'.charCodeAt(0)) + columnLetter
      columnIndex = Math.floor((columnIndex - 1) / 26)
    }
    return columnLetter
  }
  
  let { writeData } = node.config
  const { worksheet } = node.inputs
  const { complete } = context
  writeData.forEach(({ rowIndex, columnIndex, value }) => {
    const cell = worksheet.getCell(`${getColumnLetter(columnIndex)}${rowIndex}`);
    cell.value = value
  })
  complete()

}

export default execute
