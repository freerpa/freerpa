/**
 * @file: 循环节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconLoop } from '@arco-design/web-vue/es/icon'

export default {
  type: 'logicLoop',
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
        description: '当前循环的执行索引 从 0 开始',
        isConfig: true
      },
      {
        id: 'times',
        name: '循环次数',
        type: 'number',
        description: '当前循环的执行次数 从 1 开始',
        isConfig: true
      }
    ],
    endOutputs: false
  },
  config: {},
  inputs: [
    {
      id: 'data',
      name: '目标数据',
      type: ['array', 'object', 'string', 'number'],
      required: true,
      description: '根据目标数据获得循环次数：数组长度 或 对象属性个数 或 字符串长度 或 数字'
    }
  ],
  outputs: []
}
