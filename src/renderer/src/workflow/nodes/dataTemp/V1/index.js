/**
 * @file: 数据暂存节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconStorage } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dataTemp',
  name: '数据暂存',
  icon: IconStorage,
  description: '将数据暂存到暂存器中，以数组形式输出，如果需要清空暂存器，请使用清空暂存节点',
  view: false,
  config: {},
  inputs: [
    {
      id: 'data',
      name: '数据',
      type: ['object', 'array', 'string', 'number', 'boolean'],
      description: '要暂存的数据',
      required: true
    }
  ],
  outputs: [
    {
      id: 'tempStore',
      name: '暂存器',
      type: 'tempStore',
      description: '用于清空数据暂存'
    },
    {
      id: 'data',
      name: '数据',
      type: 'array',
      description: '暂存的数据'
    },
    {
      id: 'length',
      name: '长度',
      type: 'number',
      description: '暂存的数据长度'
    }
  ]
}
