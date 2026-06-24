/**
 * @file: 计数器节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { RiNumber0 } from '@remixicon/vue'
export default {
  type: 'counterV2',
  name: '计数器',
  icon: RiNumber0,
  description: '创建一个计数器，用于计数',
  view: true,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        initialValueCount: {
          id: 'initialValueCount',
          name: '初始计数',
          type: 'number',
          description: '初始计数，默认值为 0',
          default: 0,
          quickConfig: true
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'counter',
      name: '计数器',
      type: 'counter',
      description: '计数器'
    },
    {
      id: 'count',
      name: '计数',
      type: 'number',
      description: '当前计数：每次执行节点计数加 1'
    }
  ]
}
