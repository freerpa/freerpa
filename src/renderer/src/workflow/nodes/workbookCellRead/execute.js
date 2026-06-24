/**
 * @file: 浏览器节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  try {
    let { row, specifyRow, column, specifyColumn } = node.config
    const { worksheet } = node.inputs
    const { complete } = context
    const data = []
    let rowIndexs = []
    let columnIndexs = []
    if (row === 'all') {
      for (let i = 1; i <= worksheet.rowCount; i++) {
        rowIndexs.push(i)
      }
    } else {
      for (const { startRow, countRow } of specifyRow) {
        for (let i = startRow; i < startRow + countRow; i++) {
          rowIndexs.push(i)
        }
      }
    }
    if (column === 'all') {
      for (let i = 1; i <= worksheet.columnCount; i++) {
        columnIndexs.push(i)
      }
    } else {
      for (const { startColumn, countColumn } of specifyColumn) {
        for (let i = startColumn; i < startColumn + countColumn; i++) {
          columnIndexs.push(i)
        }
      }
    }
    for (const rowIndex of rowIndexs) {
      const row = worksheet.getRow(rowIndex)
      if (!row) {
        break
      }
      const rowCells = []
      for (const columnIndex of columnIndexs) {
        const cell = row.getCell(columnIndex)
        if (!cell) {
          break
        }
        rowCells.push(cell.value)
      }
      data.push(rowCells)
    }

    complete({
      data: data
    })
  } catch (error) {
    throw error
  }
}

export default execute
