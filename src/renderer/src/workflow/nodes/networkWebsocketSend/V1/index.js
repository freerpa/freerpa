/**
 * @file: WebSocket发送消息节点
 */
import { IconSend } from '@arco-design/web-vue/es/icon'

export default {
  type: 'networkWebsocketSend',
  name: 'WebSocket发送',
  icon: IconSend,
  description: 'WebSocket 发送节点：通过“WebSocket 连接”节点建立的连接发送一条消息文本。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'message',
          name: '消息内容',
          type: 'text',
          description: '要发送的消息内容',
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'socket',
      name: 'WebSocket对象',
      type: 'websocket',
      required: true,
      description: 'WebSocket 连接对象（来自“WebSocket连接”节点的 websocket 输出）'
    }
  ],
  outputs: [
    // {
    //   id: 'socket',
    //   name: 'WebSocket对象',
    //   type: 'websocket'
    // }
  ]
}
