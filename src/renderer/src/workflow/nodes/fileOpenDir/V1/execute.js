/**
 * @file: 打开目录节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import { shell } from 'electron'

const execute = async (node, context) => {
  const { config } = node
  const { complete, fs } = context
  const { dirPath } = config

  try {
    // 检查文件是否存在
    if (!fs.existsSync(dirPath)) {
      throw new Error(`目录不存在: ${dirPath}`)
    }
    // 获取要打开的路径
    const targetPath = await fs.realpath(dirPath)

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
  } catch (error) {
    throw error
  }
}

export default execute
