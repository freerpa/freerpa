/**
 * @file: 循环节点
 */
import { IconLoop } from '@arco-design/web-vue/es/icon'

export default {
  type: 'workflowLoop',
  name: '循环',
  icon: IconLoop,
  description: '循环节点：按输入数据或指定次数重复执行循环体。每次迭代向循环体注入三个变量——item（当前项）、index（循环索引）、totalTimes（总次数）；循环体内可放置任意节点，抛出异常会中断整个循环。',
  view: true,
  subFlow: {
    name: '循环体',
    startOutputs: [
      {
        id: 'item',
        name: '当前项',
        type: 'any',
        description: '当前迭代的数据项：按数据循环时为数组元素/对象属性值，按次数循环时为递增序号（从 1 开始）',
        isConfig: true
      },
      {
        id: 'index',
        name: '循环索引',
        type: 'number',
        description: '当前迭代的循环索引，起始值由“索引类型”决定（从 0 或 1 开始）',
        isConfig: true
      },
      {
        id: 'totalTimes',
        name: '循环总数',
        type: 'number',
        description: '本次循环的总迭代次数',
        isConfig: true
      }
    ],
    endOutputs: false
  },
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'type',
          name: '循环依据',
          type: 'radio',
          quickConfig: true,
          options: [
            { label: '传入数据', value: 'data' },
            { label: '指定次数', value: 'times' }
          ],
          default: 'data',
          description: '循环依据：data（按输入数据循环：数组按元素、对象按属性值、字符串按长度、数字按数值次数）或 times（按指定次数循环）'
        },
        {
          id: 'times',
          name: '循环次数',
          type: 'number',
          default: 1,
          min: 1,
          quickConfig: true,
          show: '${type} === "times"',
          description: '循环执行次数（≥1），仅当循环依据为“指定次数”时生效'
        },
        {
          id: 'indexType',
          name: '索引类型',
          type: 'radio',
          quickConfig: true,
          options: [
            { label: '从 0 开始', value: 'zero' },
            { label: '从 1 开始', value: 'one' }
          ],
          default: 'zero',
          description: '循环索引（index）的起始值：从 0 开始 或 从 1 开始'
        }
      ],
    }
  ],
  inputs: [
    {
      id: 'data',
      name: '数据',
      type: ['array', 'object', 'string', 'number'],
      required: true,
      show: '${type} === "data"',
      description: '循环数据源：数组（按元素迭代）、对象（按属性值迭代）、字符串（按长度迭代）或数字（按数值次数迭代）。仅当循环依据为“传入数据”时需连接。'
    }
  ],
  outputs: []
}
