/**
 * @file: 计数器节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconDice } from '@arco-design/web-vue/es/icon'

export default {
  type: 'counter',
  name: '计数器',
  icon: IconDice,
  description: '每次执行节点计数加1',
  view: false,
  config: {},
  inputs: [],
  outputs: [
    {
      id: 'counter',
      name: '计数器',
      type: 'counter',
      description: '用于清零计数器'
    },
    {
      id: 'count',
      name: '计数',
      type: 'number',
      description: '当前计数：每次执行节点计数加1'
    }
  ]
}
