/**
 * @file: 剪切板操作节点执行器
 * @author: FreeRPA
 * @date: 2025-07-30
 */
import { clipboard } from 'electron'

const execute = async (node, context) => {
  const { config } = node
  const { complete } = context

  const { type, content: writeContent } = config

  if (type === 'read') {
    // 读取剪切板内容
    const content = await clipboard.readText()
    complete({ content })
  } else if (type === 'write') {
    // 设置剪切板内容（write 分支此前误用未定义变量 content，错误被 catch 静默吞掉）
    await clipboard.writeText(writeContent)
    complete({ content: writeContent })
  } else if (type === 'clear') {
    // 清空剪切板内容
    await clipboard.clear()
    complete({ content: '' })
  } else {
    throw new Error('无效的操作类型')
  }
}

export default execute
