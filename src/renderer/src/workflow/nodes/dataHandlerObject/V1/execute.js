/**
 * @file: 数据处理节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import { getHandler } from '@/common';
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  try {
    const { type, handle } = config
    let result = inputs.data
    const handler = getHandler(type, handle)
    if (handler) {
      result = handler.handler(result, config)
    }
    // 返回处理结果
    complete({ result })
  } catch (error) {
    throw error
  }
}
export default execute
