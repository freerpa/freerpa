/**
 * @file: 计时器节点
 */
import { RiTimerLine } from "@remixicon/vue"
import { dynamicFields, configFields } from '../../common'

export default {
  type: 'timeBaseTimer',
  name: '计时器',
  icon: RiTimerLine,
  description: '创建一个计时器，用于计时和获取当前时间的秒数',
  view: true,
  config: {
    base: {
      name: '基础配置',
      fields: {
        timerSecond: {
          id: 'timerSecond',
          name: '计时秒数',
          default: 30,
          type: 'number',
          description: '计时器达到秒数后，继续执行后续节点',
          quickConfig: true
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'timer',
      name: '计时器',
      type: 'timer',
      description: '计时器'
    },
    {
      id: 'second',
      name: '当前秒数',
      type: 'number',
      description: '当前计时器的秒数'
    },
    {
      id: 'remainingSecond',
      name: '剩余秒数',
      type: 'number',
      description: '计时器剩余的秒数'
    }
  ]
}
