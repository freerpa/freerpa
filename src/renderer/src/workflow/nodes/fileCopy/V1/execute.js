/**
 * @file: 复制文件节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import path from 'path'

const execute = async (node, context) => {
  const { config } = node
  const { complete, fs } = context
  const { copyType, sourcePath, sourceDirPath, targetPath, overwrite } = config

  try {
    // 获取实际的源路径
    const realSourcePath = copyType === 'file' ? sourcePath : sourceDirPath
    // 检查源路径是否存在
    if (!fs.existsSync(realSourcePath)) {
      throw new Error(`源路径不存在: ${realSourcePath}`)
    }
    // 获取目标路径
    let realTargetPath = path.join(targetPath, path.basename(realSourcePath))
    // 创建目标目录（如果需要）
    // 获取源文件状态
    const sourceStats = fs.statSync(realSourcePath)
    const isDirectory = sourceStats.isDirectory()
    const targetDir = isDirectory ? realTargetPath : path.dirname(realTargetPath)
    if (!fs.existsSync(targetDir)) {
      await fs.mkdir(targetDir, { recursive: true })
    }

    try {
      // 复制目录
      await fs.copy(realSourcePath, realTargetPath, {
        overwrite: overwrite,
        errorOnExist: true
      })
    } catch (error) {
      throw error
    }
    // 返回结果
    complete({
      targetPath: realTargetPath
    })
  } catch (error) {
    throw error
  }
}

export default execute
