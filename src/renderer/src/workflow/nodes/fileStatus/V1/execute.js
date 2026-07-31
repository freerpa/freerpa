/**
 * @file: 文件状态节点执行器
 * @author: FreeRPA
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { inputs } = node
  const { complete, fs } = context

  try {
    // 获取文件路径
    const filePath = inputs.path

    if (!filePath) {
      throw new Error('未提供有效的文件路径')
    }

    let exists = false
    let isFile = false
    let status = null

    try {
      // 使用context提供的fs实例获取文件状态
      status = await fs.stat(filePath)
      isFile = status.isFile()
      exists = isFile || status.isDirectory()

    } catch (statError) {
      // 文件不存在时，所有状态都保持默认值
      if (statError.code !== 'ENOENT') {
        // 其他错误抛出
        throw new Error(`获取文件状态失败: ${statError.message}`)
      }
    }

    // 准备输出数据
    const outputData = {
      exists,
      isFile,
      status: null
    }

    // 如果配置包含详细信息，则添加完整状态
    if (status) {
      outputData.status = {
        dev: status.dev,
        ino: status.ino,
        mode: status.mode,
        nlink: status.nlink,
        uid: status.uid,
        gid: status.gid,
        rdev: status.rdev,
        size: status.size,
        blksize: status.blksize,
        blocks: status.blocks,
        atime: status.atime.toISOString(),
        mtime: status.mtime.toISOString(),
        ctime: status.ctime.toISOString(),
        birthtime: status.birthtime ? status.birthtime.toISOString() : null,
        isFile: status.isFile(),
        isDirectory: status.isDirectory(),
        isSymbolicLink: status.isSymbolicLink(),
        isSocket: status.isSocket(),
        isFIFO: status.isFIFO(),
        isCharacterDevice: status.isCharacterDevice(),
        isBlockDevice: status.isBlockDevice()
      }
    }

    // 完成节点执行并返回结果
    complete(outputData)
  } catch (error) {
    // 抛出错误
    throw error
  }
}

export default execute