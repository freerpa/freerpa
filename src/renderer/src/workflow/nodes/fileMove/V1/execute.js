/**
 * @file: 移动文件节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import path from 'path'

const execute = async (node, context) => {
  const { config } = node
  const { complete, fs } = context
  const { moveType, sourcePath, sourceDirPath, targetPath, overwrite } = config
  try {
    // 获取实际的源路径
    const realSourcePath = moveType === 'file' ? sourcePath : sourceDirPath

    // 检查源路径是否存在
    if (!fs.existsSync(realSourcePath)) {
      throw new Error(`源路径不存在: ${realSourcePath}`)
    }

    // 获取目标路径
    let realTargetPath = path.join(targetPath, path.basename(realSourcePath))
    // 如果目标路径已存在且需要覆盖，则删除目标路径
    if (fs.existsSync(realTargetPath) && overwrite) {
      await fs.remove(realTargetPath)
    }
    try {
      // 移动文件/目录
      await fs.move(realSourcePath, realTargetPath)
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
