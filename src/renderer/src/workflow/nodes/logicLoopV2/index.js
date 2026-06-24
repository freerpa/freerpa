/**
 * @file: 循环节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconLoop } from '@arco-design/web-vue/es/icon'

export default {
  type: 'logicLoopV2',
  name: '循环',
  icon: IconLoop,
  description: '循环处理数据',
  view: true,
  subFlow: {
    name: '循环体',
    startOutputs: [
      {
        id: 'item',
        name: '当前项',
        type: 'any',
        description: '当前循环的数据项',
        isConfig: true
      },
      {
        id: 'index',
        name: '循环索引',
        type: 'number',
        description: '当前循环的执行索引',
        isConfig: true
      },
      {
        id: 'totalTimes',
        name: '循环总数',
        type: 'number',
        description: '循环的总次数',
        isConfig: true
      }
    ],
    endOutputs: false
  },
  config: {
    basic: {
      name: '基础配置',
      fields: {
        type: {
          id: 'type',
          name: '循环依据',
          type: 'radio',
          quickConfig: true,
          options: [
            { label: '传入数据', value: 'data' },
            { label: '指定次数', value: 'times' }
          ],
          default: 'data',
          description: '根据数据项循环 或 指定次数循环'
        },
        times: {
          id: 'times',
          name: '循环次数',
          type: 'number',
          default: 1,
          min: 1,
          quickConfig: true,
          show: '${type} === "times"',
          description: '指定循环的次数，仅在类型为次数循环时生效'
        },
        indexType: {
          id: 'indexType',
          name: '索引类型',
          type: 'radio',
          quickConfig: true,
          options: [
            { label: '从 0 开始', value: 'zero' },
            { label: '从 1 开始', value: 'one' }
          ],
          default: 'zero',
          description: '指定循环索引的起始值'
        }
      },
    }
  },
  inputs: [
    {
      id: 'data',
      name: '数据',
      type: ['array', 'object', 'string', 'number'],
      required: true,
      show: '${type} === "data"',
      description: '根据目标数据获得循环次数：数组长度 或 对象属性个数 或 字符串长度 或 数字'
    }
  ],
  outputs: []
}
