/**
 * @file: 模型数据 Excel 导入导出（流式读写，支持大文件）
 * 导出：分页拉取 → WorkbookWriter 流式写（超百万行自动分 Sheet）
 * 导入：WorkbookReader 流式读 → 分批 batchCreateModelData
 */
import ExcelJS from 'exceljs'
import { getModel } from './modelCrud.js'
import { batchCreateModelData, getModelData } from './modelDataCrud.js'

export const exportExcel = async ({ filePath, modelId, conditions, filters, sort, readFields }) => {
  let total = 1
  let exportDataNum = 0
  const params = { modelId, page: 1, pageSize: 5000, filters: filters || {}, conditions: conditions || [], sort: sort || null, readFields: readFields || [] }
  params.readFields.push('created_at')
  const options = { filename: filePath, useStyles: true, useSharedStrings: true }
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options)
  let worksheet = null
  let headers = []
  let rowCount = 0
  let sheetIndex = 1
  while (exportDataNum < total) {
    const res = await getModelData(params)
    total = res.total
    headers = [...res.fields, { name: 'created_at', description: '创建时间' }]
    if (rowCount >= 1000000 || worksheet === null) {
      worksheet = workbook.addWorksheet(`Sheet${sheetIndex++}`, { views: [{ state: 'frozen', ySplit: 1 }] })
      worksheet.columns = headers.map((h) => ({ header: h.description, key: h.name }))
      rowCount = 0
    }
    res.data.forEach((item) => { rowCount++; worksheet.addRow(item).commit() })
    global.mainView.webContents.send('data:importExcelProgress', { total, finished: exportDataNum })
    exportDataNum += res.data.length
    params.page++
  }
  worksheet.commit()
  await workbook.commit()
}

export const importExcel = async ({ filePath, modelId }) => {
  const model = await getModel(modelId).catch(() => null)
  if (!model) throw new Error('模型不存在')
  const fields = JSON.parse(model.fields)
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath)
  const rows = []
  let finished = 0
  reader.on('worksheet', (worksheet) => {
    let isColumnHeader = true
    const pageSize = 1000
    worksheet.on('row', async (row) => {
      if (isColumnHeader) { isColumnHeader = false; return }
      const item = {}
      fields.forEach((h, index) => { item[h.name] = row.getCell(index + 1).value })
      rows.push(item)
      if (rows.length >= pageSize) {
        const batchRows = [...rows]
        rows.length = 0
        await batchCreateModelData({ modelId, data: batchRows, batchSize: pageSize }).catch(() => null)
        finished += batchRows.length
        global.mainView.webContents.send('data:importExcelProgress', { total: '', finished })
      }
    })
  })
  return new Promise((resolve, reject) => {
    reader.on('end', async () => {
      if (rows.length > 0) {
        await batchCreateModelData({ modelId, data: rows }).catch(() => null)
        rows.length = 0
      }
      resolve()
    })
    reader.on('error', reject)
    reader.read()
  })
}
