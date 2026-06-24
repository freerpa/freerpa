// 获取连线状态
export const getConnectionClass = (connection, pendingConnection, validateConnection) => {
  // 如果存在连线状态
  if (pendingConnection) {
    if (pendingConnection.handleType === connection.type) {
      return 'no-connection'
    }
    // 获取连线参数
    let params = {
      source: connection.id,
      target: pendingConnection.nodeId,
      sourceHandle: connection.handle,
      targetHandle: pendingConnection.handleId
    }
    // 如果连线状态的目标类型是source
    if (pendingConnection.handleType === 'source') {
      // 更新连线参数
      params = {
        source: pendingConnection.nodeId,
        target: connection.id,
        sourceHandle: pendingConnection.handleId,
        targetHandle: connection.handle
      }
    }
    // 返回连线状态
    return validateConnection(params) ? 'yes-connection' : 'no-connection'
  }
  // 返回空字符串
  return ''
}
