/**
 * @file: 文件删除节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */

const execute = async (node, context) => {
  const { config } = node
  const { complete, fs } = context
  const { deleteType, filePath, dirPath, force } = config
  let deletePath = deleteType === 'file' ? filePath : dirPath
  try {
    //如果路径不存在直接完成
    if (!fs.existsSync(deletePath)) {
      complete()
      return
    }
    // 获取文件状态
    const stats = fs.statSync(deletePath)
    const isDirectory = stats.isDirectory()

    if (deleteType === 'file') {
      if (!isDirectory) {
        fs.unlinkSync(deletePath)
      }
    } else {
      if (!isDirectory) {
        deletePath = path.dirname(deletePath)
      }
      fs.rmSync(deletePath, {
        recursive: true,
        force: force
      })
    }

    // 返回结果
    complete()
  } catch (error) {
    throw error
  }
}

export default execute
