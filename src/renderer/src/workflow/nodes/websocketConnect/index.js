/**
 * @file: WebSocket连接节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconThunderbolt } from '@arco-design/web-vue/es/icon'

export default {
  type: 'websocketConnect',
  name: 'WebSocket连接',
  icon: IconThunderbolt,
  description: '建立WebSocket连接',
  config: {
    basic: {
      name: '基础配置',
      fields: {
        url: {
          id: 'url',
          name: '连接地址',
          type: 'input',
          description: 'WebSocket服务器地址',
          quickConfig: true,
          required: true
        },
        protocols: {
          id: 'protocols',
          name: '子协议',
          type: 'input',
          description: 'WebSocket子协议，多个用逗号分隔'
        },
        proxyUrl: {
          id: 'proxyUrl',
          name: '代理配置',
          type: 'text',
          default: '',
          description: '为空不使用代理，格式:http://user:pass@host:port',
          show: '${environment} == "node"'
        },
        headers: {
          id: 'headers',
          name: '请求头',
          type: 'array',
          codeView: {
            type: 'object',
            key: 'key',
            value: 'value'
          },
          fields: {
            key: {
              id: 'key',
              name: '名称',
              type: 'input',
              required: true
            },
            value: {
              id: 'value',
              name: '值',
              type: 'input',
              required: true
            }
          },
          description: 'HTTP请求头'
        }
      }
    },
    advanced: {
      name: '高级配置',
      fields: {
        timeout: {
          id: 'timeout',
          name: '连接超时',
          type: 'number',
          default: 5000,
          description: '连接超时时间（毫秒）'
        },
        reconnect: {
          id: 'reconnect',
          name: '自动重连',
          type: 'switch',
          default: true,
          description: '连接断开时是否自动重连'
        },
        maxRetries: {
          id: 'maxRetries',
          name: '最大重试',
          type: 'number',
          default: 3,
          show: '${reconnect}',
          description: '最大重连次数'
        },
        retryInterval: {
          id: 'retryInterval',
          name: '重试间隔',
          type: 'number',
          default: 1000,
          show: '${reconnect}',
          description: '重连间隔时间（毫秒）'
        },
        heartbeat: {
          id: 'heartbeat',
          name: '心跳监测',
          type: 'switch',
          default: false,
          description: '是否启用心跳监测'
        },
        heartbeatInterval: {
          id: 'heartbeatInterval',
          name: '心跳间隔',
          type: 'number',
          default: 30000,
          show: '${heartbeat}',
          description: '心跳监测间隔（毫秒）'
        },
        heartbeatMessage: {
          id: 'heartbeatMessage',
          name: '心跳消息',
          type: 'input',
          default: 'ping',
          show: '${heartbeat}',
          description: '心跳监测消息内容'
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'websocket',
      name: 'WebSocket对象',
      type: 'websocket',
      description: 'WebSocket连接对象'
    },
    {
      id: 'connected',
      name: '连接状态',
      type: 'boolean',
      description: '连接是否成功'
    },
    {
      id: 'message',
      name: '消息',
      type: 'string',
      description: 'WebSocket消息'
    }
  ]
}
