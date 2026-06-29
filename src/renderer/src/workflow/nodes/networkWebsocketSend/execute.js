/**
 * @file: WebSocket发送消息节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  const socket = inputs.socket

  try {
    const { message = '', delay = 0 } = config
    // 发送消息
    try {
      socket.send(message)
      complete()
    } catch (error) {
      throw new Error('WebSocket连接已关闭')
    }
  } catch (error) {
    throw error
  }
}

export default execute
