/**
 * @file: WebSocket监听节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { next, onBeforeDestroy } = context

  try {
    const page = inputs.page
    const { url } = config

    // 状态管理
    let state = {
      isConnected: false,
      messageCount: 0,
      error: null,
      connections: new Map(), // 存储 requestId -> {url, ws} 的映射
      activeWebsockets: new Map() // 存储 url -> ws 的映射
    }
    // 处理WebSocket消息
    const handleMessage = async (message, requestId, isReceive) => {
      const connection = state.connections.get(requestId)
      if (!connection) return
      next({
        // message: {
        //   type: isReceive,
        //   message
        // }
        message
      })
    }

    // 启用网络监听
    await page._client().send('Network.enable', {
      maxTotalBufferSize: 10000000,
      maxResourceBufferSize: 5000000,
      maxPostDataSize: 5000000
    })

    // 添加WebSocket接受消息监听
    page._client().on('Network.webSocketFrameReceived', async ({ requestId, response }) => {
      if (!state.connections.has(requestId)) return

      try {
        await handleMessage(response.payloadData, requestId, 'receive')
      } catch (error) {
        console.error('处理WebSocket接收消息失败:', error)
      }
    })

    // 添加WebSocket发送消息监听
    page._client().on('Network.webSocketFrameSent', async ({ requestId, response }) => {
      if (!state.connections.has(requestId)) return

      try {
        // await handleMessage(response.payloadData, requestId, 'send')
      } catch (error) {
        console.error('处理WebSocket发送消息失败:', error)
      }
    })

    page._client().on('Network.webSocketCreated', ({ requestId, url: wsUrl }) => {
      if (!url || wsUrl.includes(url)) {
        state.connections.set(requestId, { url: wsUrl })
      }
    })

    page._client().on('Network.webSocketClosed', ({ requestId, timestamp }) => {
      const connection = state.connections.get(requestId)
      if (!connection) return

      const { url: wsUrl } = connection
      state.connections.delete(requestId)
      state.activeWebsockets.delete(wsUrl)
    })

    page._client().on('Network.webSocketFrameError', ({ requestId, timestamp, errorMessage }) => {
      const connection = state.connections.get(requestId)
      if (!connection) return
    })

    // 注册清理函数
    const cleanup = async () => {
      try {
        await page._client().send('Network.disable')
        await page._client().detach()
      } catch (error) {
        console.error('清理CDP会话失败:', error)
      }
    }
    onBeforeDestroy(cleanup)
  } catch (error) {
    throw error
  }
}

export default execute
