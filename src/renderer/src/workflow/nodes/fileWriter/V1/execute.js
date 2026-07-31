/**
 * @file: 文件写入节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import iconv from 'iconv-lite'
import { safeWriteFileSync } from '@/common'

const execute = async (node, context) => {
  const { config } = node
  const { complete, fs } = context
  const { filePath, encoding, writeMode, appendLineBreak } = config

  try {
    // 准备写入内容
    let writeContent = config.content

    if (typeof writeContent !== 'string') {
      // 如果不是字符串，转换为字符串
      writeContent = String(writeContent)
    }

    if (writeMode === 'append' && appendLineBreak) {
      // 追加模式，前面添加换行符
      writeContent = '\n' + writeContent
    }

    // 编码转换
    const buffer = iconv.encode(writeContent, encoding)

    // 写入文件
    if (writeMode === 'append') {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        // 如果文件不存在，创建文件
        safeWriteFileSync(fs, filePath, '')
      }
      // 追加模式
      fs.appendFileSync(filePath, buffer)
    } else {
      // 覆盖模式
      safeWriteFileSync(fs, filePath, buffer)
    }

    // 返回结果
    complete()
  } catch (error) {
    throw error
  }
}

export default execute
