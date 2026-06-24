/**
 * @file: 延时节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { config } = node
  const { complete } = context
  const { duration = 1000 } = config
  await new Promise(resolve => setTimeout(resolve, duration))
  // 发送结果
  complete()
}

export default execute
