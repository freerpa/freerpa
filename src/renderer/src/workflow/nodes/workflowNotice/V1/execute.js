/**
 * @file: 通知节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
const execute = async (node, context) => {
  const { config } = node
  const { complete, sendToRenderer } = context

  try {
    const { content, type } = config
    sendToRenderer(`flowEventBus:onNotice:${context.flowId}`, {
      nodeId: node.id,
      type,
      content,
    })
    complete()
  } catch (error) {
    throw error
  }
}

export default execute
