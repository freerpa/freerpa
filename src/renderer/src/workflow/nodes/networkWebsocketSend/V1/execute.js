/**
 * @file: WebSocket发送消息节点执行器
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  const socket = inputs.socket

  
  const { message = '', delay = 0 } = config
  // 发送前延迟（此前 delay 解构了但未生效）
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
  // 发送消息
  try {
    socket.send(message)
    complete()
  } catch (error) {
    throw new Error('WebSocket连接已关闭')
  }

}

export default execute
