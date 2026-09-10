/**
 * @file: 数据暂存节点
 */
import { IconStorage } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dbTemp',
  name: '数据暂存',
  icon: IconStorage,
  description: '数据暂存节点：将输入数据累积暂存到暂存器（数组），每次执行追加一条，并输出暂存器引用、暂存的数据数组与长度。如需清空请使用“清空暂存”节点。',
  view: false,
  config: [],
  inputs: [
    {
      id: 'data',
      name: '数据',
      type: ['object', 'array', 'string', 'number', 'boolean'],
      description: '要暂存的数据（每次执行追加到暂存器末尾）',
      required: true
    }
  ],
  outputs: [
    {
      id: 'tempStore',
      name: '暂存器',
      type: 'tempStore',
      description: '暂存器对象（含清空函数），传给“清空暂存”节点使用'
    },
    {
      id: 'data',
      name: '数据',
      type: 'array',
      description: '暂存器中累积的所有数据（数组）'
    },
    {
      id: 'length',
      name: '长度',
      type: 'number',
      description: '暂存的数据长度'
    }
  ]
}
