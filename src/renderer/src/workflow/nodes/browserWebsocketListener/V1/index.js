/**
 * @file: WebSocket监听节点
 */
import { IconThunderbolt } from '@arco-design/web-vue/es/icon'

export default {
  type: 'browserWebsocketListener',
  name: 'WebSocket监听',
  icon: IconThunderbolt,
  description: 'WebSocket 监听节点：监听页面发起的 WebSocket 连接（可按地址过滤），接收到服务端推送的帧数据时输出消息内容。',
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'url',
          name: '监听地址',
          type: 'input',
          description: '要监听的 WebSocket 地址关键字（为空时监听所有连接）',
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
      required: true,
      description: '浏览器页面对象（来自“打开浏览器”节点）'
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
