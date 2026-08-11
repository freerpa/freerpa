/**
 * @file: 工作薄保存节点执行器
 */
import path from 'path'
const execute = async (node, context) => {
  const { filePath, fileName, overwrite } = node.config
  const { worksheet } = node.inputs
  const { complete, fs } = context
  const _filePath = path.join(filePath, fileName + '.xlsx')
  const realPath = path.join(fs.realpathSync(filePath), fileName + '.xlsx')

  // 覆盖保护：overwrite 配置此前解构了但未生效
  if (!overwrite && fs.existsSync(realPath)) {
    throw new Error(`文件已存在且未开启覆盖: ${realPath}`)
  }

  // workbook 引用优先取显式挂载的 worksheet.workbook（workbookCreate 注入），
  // 兼容旧数据回退 exceljs 私有 _workbook
  const workbook = worksheet.workbook || worksheet._workbook
  if (!workbook) {
    throw new Error('未找到工作表所属的工作簿（请确保上游由「工作簿创建」节点提供）')
  }
  await workbook.xlsx.writeFile(realPath)
  complete({
    filePath: _filePath
  })
}

export default execute
