/**
 * @file: 通知节点执行器
 */
const execute = async (node, context) => {
  const { config } = node
  const { complete, sendToRenderer } = context

  
  const { content, type } = config
  sendToRenderer(`flowEventBus:onNotice:${context.flowId}`, {
    nodeId: node.id,
    type,
    content,
  })
  complete()

}

export default execute
