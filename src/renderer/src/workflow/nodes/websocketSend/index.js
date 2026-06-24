/**
 * @file: WebSocket发送消息节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconSend } from '@arco-design/web-vue/es/icon'

export default {
  type: 'websocketSend',
  name: 'WebSocket发送',
  icon: IconSend,
  description: '发送WebSocket消息',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        message: {
          id: 'message',
          name: '消息内容',
          type: 'text',
          description: '要发送的消息内容',
          quickConfig: true
        }
      }
    }
  },
  inputs: [
    {
      id: 'socket',
      name: 'WebSocket对象',
      type: 'websocket',
      required: true
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
