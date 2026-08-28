/**
 * @file: 打开目录节点执行器
 */
import { shell } from 'electron'

const execute = async (node, context) => {
  const { config } = node
  const { complete, fs } = context
  const { dirPath } = config

  
  // 检查文件是否存在
  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`)
  }
  // 获取要打开的路径（fs.realpath 为回调式 API，改用同步版避免回调缺失报错）
  const targetPath = fs.realpathSync(dirPath)

  try {
    // 判断是否是目录
    const isDir = fs.statSync(dirPath).isDirectory()
    if (!isDir) {
      await shell.showItemInFolder(targetPath)
    } else {
      await shell.openPath(targetPath)
    }
    complete({ success: true })
  } catch (error) {
    throw new Error(`打开目录失败: ${error.message}`)
  }

}

export default execute
