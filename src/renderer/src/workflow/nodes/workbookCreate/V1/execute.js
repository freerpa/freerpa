/**
 * @file: 工作簿创建节点执行器
 */
import Excel from 'exceljs'
const execute = async (node, context) => {
  
  const { createType, filePath } = node.config
  const { complete, fs } = context
  const workbook = new Excel.Workbook()
  let worksheet = workbook.addWorksheet('Sheet1')
  if (createType === 'file') {
    await workbook.xlsx.readFile(fs.realpathSync(filePath))
    worksheet = workbook.getWorksheet(1)
  }
  if (!worksheet) {
    worksheet = workbook.addWorksheet('Sheet1')
  }

  worksheet.utils = {      /**
  * @description: 获取列号 AA、AB 等
  * @param {number} columnIndex 列号索引
  * @return {string} 列号
  */
    getColumnLetter: (columnIndex) => {
      let columnLetter = ''
      while (columnIndex > 0) {
        const charIndex = (columnIndex - 1) % 26
        columnLetter = String.fromCharCode(charIndex + 'A'.charCodeAt(0)) + columnLetter
        columnIndex = Math.floor((columnIndex - 1) / 26)
      }
      return columnLetter
    },
    /**
     * @description: 获取列号索引
     * @param {string} column 列号
     * @return {number} 列号索引
     */
    getColumnIndex: (column) => {
      let columnIndex = 0
      for (let i = 0; i < column.length; i++) {
        const char = column[i]
        const charIndex = char.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) + 1
        columnIndex = columnIndex * 26 + charIndex
      }
      return columnIndex
    }
  }

  // worksheet.workbook 为 exceljs 原生 getter（返回所属工作簿），无需也不可手动挂载（getter-only 赋值会抛 TypeError）

  complete({
    worksheet: worksheet
  })

}

export default execute
