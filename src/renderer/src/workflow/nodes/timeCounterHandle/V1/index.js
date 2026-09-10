/**
 * @file: 操作计数器节点
 */
import { RiIncreaseDecreaseLine } from "@remixicon/vue"

export default {
  type: 'timeCounterHandle',
  name: '操作计数器',
  icon: RiIncreaseDecreaseLine,
  description: '操作计数器节点：对上游“计数器”节点创建的计数器执行清零、增加或减少操作，并输出操作后的计数值。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'type',
          name: '操作类型',
          type: 'radio',
          default: 'clear',
          description: '操作类型：clear（清零，恢复初始计数值）/ increase（计数加 1）/ reduce（计数减 1，最小到 0）',
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
      ]
    }
  ],
  inputs: [
    {
      id: 'counter',
      name: '计数器',
      type: 'counter',
      description: '要操作的计数器（来自“计数器”节点的 counter 输出）',
      required: true
    }
  ],
  outputs: [
    {
      id: 'count',
      name: '计数',
      type: 'number',
      description: '操作后的当前计数值'
    }
  ]
}
