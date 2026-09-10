/**
 * @file: 计时器节点
 */
import { RiTimerLine } from "@remixicon/vue"

export default {
  type: 'timeBaseTimer',
  name: '计时器',
  icon: RiTimerLine,
  description: '计时器节点：创建一个按秒计时的计时器并自动开始。每过 1 秒更新输出（当前秒数 second、剩余秒数 remainingSecond），倒计时到 0 时自动完成节点并继续执行后续节点。计时器对象可交给“操作计时器”节点控制。',
  view: true,
  config: [
    {
      id: 'base',
      name: '基础配置',
      fields: [
        {
          id: 'timerSecond',
          name: '计时秒数',
          default: 30,
          type: 'number',
          description: '倒计时总秒数：从 0 开始计时，剩余秒数减到 0 时自动完成节点并继续执行',
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      id: 'timer',
      name: '计时器',
      type: 'timer',
      description: '计时器对象（含 start/stop/clear 方法），可传给“操作计时器”节点控制'
    },
    {
      id: 'second',
      name: '当前秒数',
      type: 'number',
      description: '当前已计时的秒数（自开始/清零起累计）'
    },
    {
      id: 'remainingSecond',
      name: '剩余秒数',
      type: 'number',
      description: '剩余秒数（总秒数 - 当前秒数）'
    }
  ]
}
