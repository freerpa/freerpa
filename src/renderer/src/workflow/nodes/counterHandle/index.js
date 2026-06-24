/**
 * @file: 操作计数器节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { RiIncreaseDecreaseLine } from "@remixicon/vue"

export default {
  type: 'counterHandle',
  name: '操作计数器',
  icon: RiIncreaseDecreaseLine,
  description: '操作计数器',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        type: {
          id: 'type',
          name: '操作类型',
          type: 'radio',
          default: 'clear',
          description: '操作类型',
          options: [
            {
              label: '清零',
              value: 'clear'
            },
            {
              label: '增加',
              value: 'increase'
            },
            {
              label: '减少',
              value: 'reduce'
            }
          ],
          quickConfig: true
        }
      }
    }
  },
  inputs: [
    {
      id: 'counter',
      name: '计数器',
      type: 'counter',
      description: '要操作的计数器',
      required: true
    }
  ],
  outputs: [
    {
      id: 'count',
      name: '计数',
      type: 'number',
      description: '当前计数'
    }
  ]
}
