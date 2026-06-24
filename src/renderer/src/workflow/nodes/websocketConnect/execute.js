/**
 * @file: WebSocket连接节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import WebSocket from 'ws'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
const execute = async (node, context) => {
  const { config } = node
  const { next, onBeforeDestroy } = context
  const {
    proxyUrl,
    protocols,
    headers,
    timeout,
    reconnect,
    maxRetries,
    retryInterval,
    heartbeat,
    heartbeatInterval,
    heartbeatMessage
  } = config

  let url = config.url
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = 'ws://' + url
  }

  let ws = null
  let retryCount = 0
  let heartbeatTimer = null
  let reconnectTimer = null
  let isDestroyed = false

  // 清理函数
  const cleanup = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
  }

  // 注册清理函数
  onBeforeDestroy(() => {
    isDestroyed = true
    cleanup()
  })

  // 启动心跳检测
  const startHeartbeat = () => {
    if (!heartbeat || !ws || ws.readyState !== WebSocket.OPEN) return

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
    }

    heartbeatTimer = setInterval(() => {
      try {
        ws.send(heartbeatMessage)
      } catch (error) {
        console.error('发送心跳消息失败:', error)
      }
    }, heartbeatInterval)
  }

  // 重新连接
  const reconnectWebSocket = () => {
    if (!reconnect || isDestroyed || retryCount >= maxRetries) {
      return
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    reconnectTimer = setTimeout(() => {
      retryCount++
      connectWebSocket()
    }, retryInterval)
  }

  // 建立连接
  const connectWebSocket = async () => {
    try {
      cleanup()
      // 解析子协议
      const protocolList = protocols ? protocols.split(',').map((p) => p.trim()) : []
      const headersObj = headers.reduce((acc, header) => {
        acc[header.key] = header.value
        return acc
      }, {})

      const onOpen = () => {
        console.log('WebSocket连接成功')
        retryCount = 0
        startHeartbeat()
        next({
          websocket: ws,
          connected: true,
          message: ''
        })
      }

      const onClose = () => {
        console.log('WebSocket连接关闭')
        cleanup()
        next({
          websocket: null,
          connected: false,
          message: ''
        })
        reconnectWebSocket()
      }

      const onError = (error) => {
        console.error('WebSocket连接错误:', error)
        cleanup()
        reconnectWebSocket()
      }

      const onMessage = (data) => {
        console.log('WebSocket收到消息:', data)
        //处理消息
        next({
          websocket: ws,
          connected: true,
          message: data.toString()
        })
      }
      
      // 配置WebSocket选项
      const wsOptions = {
        headers: headersObj,
        timeout,
        handshakeTimeout: timeout
      }
      // 处理代理
      if (proxyUrl) {
        let proxyServer = proxyUrl.trim().toLowerCase()
        // 解析代理配置
        const proxyProtocol = ['http:', 'https:', 'socks4:', 'socks5:']
        // 检查代理协议是否正确
        if (!proxyProtocol.some(protocol => proxyServer.startsWith(protocol))) {
          proxyServer = `http://${proxyServer}`
        }
        // 检查代理协议是否为socks
        if (proxyServer.startsWith('socks')) {
          const agent = new SocksProxyAgent(proxyServer)
          wsOptions.agent = agent
        } else {
          const agent = new HttpsProxyAgent(proxyServer)
          wsOptions.agent = agent
        }
      }

      ws = new WebSocket(url, protocolList, wsOptions)

      // 连接成功
      ws.on('open', onOpen)

      // 连接关闭
      ws.on('close', onClose)

      // 连接错误
      ws.on('error', onError)

      // 接收消息
      ws.on('message', onMessage)

      // 连接超时处理
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.CONNECTING) {
          ws.terminate()
          throw new Error(`连接超时 (${timeout}ms)`)
        }
      }, timeout)

    } catch (error) {
      cleanup()
      throw error
    }
  }

  // 开始连接
  try {
    connectWebSocket()
  } catch (error) {
    cleanup()
    throw error
  }
}

export default execute
