/**
 * @file: WebSocket监听节点
 */
import { IconThunderbolt } from '@arco-design/web-vue/es/icon'

export default {
  type: 'browserWebsocketListener',
  name: 'WebSocket监听',
  icon: IconThunderbolt,
  description: '监听WebSocket通信',
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'url',
          name: '监听地址',
          type: 'input',
          description: '要监听的WebSocket地址',
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      required: true
    }
  ],
  outputs: [
    {
      id: 'message',
      name: '消息数据',
      type: 'string',
      description: '接收到的WebSocket消息'
    }
  ]
}
