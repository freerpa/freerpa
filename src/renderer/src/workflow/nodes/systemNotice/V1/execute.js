/**
 * @file: 通知节点执行器
 */
const execute = async (node, context) => {
  const { config } = node
  const { complete, sendToRenderer } = context

  
  const { content, type, title } = config
  sendToRenderer(`flowEventBus:onNotice:${context.flowId}`, {
    nodeId: node.id,
    type,
    title,
    content,
  })
  complete()

}

export default execute
