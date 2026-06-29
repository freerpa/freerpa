/**
 * @file: 剪切板操作节点执行器
 * @author: AutoMan
 * @date: 2025-07-30
 */
import { clipboard } from 'electron'

const execute = async (node, context) => {
  const { config } = node
  const { complete } = context

  try {
    const { type, content: writeContent } = config

    if (type === 'read') {
      // 读取剪切板内容
      const content = await clipboard.readText()
      complete({ content })
    } else if (type === 'write') {
      // 设置剪切板内容
      await clipboard.writeText(writeContent)
      complete({ content })
    } else if (type === 'clear') {
      // 清空剪切板内容
      await clipboard.clear()
      complete({ content: '' })
    } else {
      throw new Error('无效的操作类型')
    }
  } catch (error) {
    complete({ content: '' })
  }
}

export default execute
