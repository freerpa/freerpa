/**
 * @file: 计时器操作节点
 */
import { RiTimerFlashLine } from "@remixicon/vue"

export default {
  type: 'timeBaseTimerHandle',
  name: '操作计时器',
  icon: RiTimerFlashLine,
  description: '操作计时器节点：对上游“计时器”节点创建的计时器执行清零、开始或停止操作。',
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
          description: '操作类型：clear（清零，秒数重置为 0）/ start（开始计时）/ stop（停止计时）',
          options: [
            {
              label: '清零',
              value: 'clear'
            },
            {
              label: '开始',
              value: 'start'
            },
            {
              label: '停止',
              value: 'stop'
            }
          ],
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'timer',
      name: '计时器',
      type: 'timer',
      description: '要操作的计时器（来自“计时器”节点的 timer 输出）',
      required: true
    }
  ],
  outputs: []
}
