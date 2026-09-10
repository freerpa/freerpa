/**
 * @file: 计数器节点
 */
import { RiNumber0 } from '@remixicon/vue'
export default {
  type: 'timeCounter',
  name: '计数器',
  icon: RiNumber0,
  description: '计数器节点：创建一个持久计数器（首次执行时按“初始计数”初始化），输出计数器对象与当前计数值 count。计数增减由“操作计数器”节点控制。',
  view: true,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'initialValueCount',
          name: '初始计数',
          type: 'number',
          description: '计数器的初始计数值（首次执行时生效），默认 0',
          default: 0,
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      id: 'counter',
      name: '计数器',
      type: 'counter',
      description: '计数器对象（含 increase/reduce/clear 方法），可传给“操作计数器”节点控制'
    },
    {
      id: 'count',
      name: '计数',
      type: 'number',
      description: '当前计数值'
    }
  ]
}
