/**
 * @file: 文件删除节点执行器
 */

import path from 'node:path'

const execute = async (node, context) => {
  const { config } = node
  const { complete, fs } = context
  const { deleteType, filePath, dirPath, force } = config
  let deletePath = deleteType === 'file' ? filePath : dirPath
  //如果路径不存在直接完成
  if (!fs.existsSync(deletePath)) {
    complete()
    return
  }
  // 获取文件状态
  const stats = fs.statSync(deletePath)
  const isDirectory = stats.isDirectory()

  if (deleteType === 'file') {
    if (isDirectory) {
      // 明确报错而非静默跳过（原实现：删文件遇到目录时什么都不做）
      throw new Error(`deleteType=file 但目标是目录：${deletePath}（请改用目录删除）`)
    }
    fs.unlinkSync(deletePath)
  } else {
    if (!isDirectory) {
      // 禁止删除父目录：原实现 deleteType=dir 遇到文件时 path.dirname() 会误删整个父目录（高危）
      throw new Error(`deleteType=dir 但目标是文件：${deletePath}（请改用文件删除）`)
    }
    fs.rmSync(deletePath, {
      recursive: true,
      force: force
    })
  }

  // 返回结果
  complete()
}

export default execute
