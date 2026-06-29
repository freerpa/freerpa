/**
 * @file: 计时器操作节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { RiTimerFlashLine } from "@remixicon/vue"

export default {
  type: 'timeBaseTimerHandle',
  name: '操作计时器',
  icon: RiTimerFlashLine,
  description: '对指定计时器进行清零、开始、停止操作',
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
      }
    }
  },
  inputs: [
    {
      id: 'timer',
      name: '计时器',
      type: 'timer',
      description: '要操作的计时器',
      required: true
    }
  ],
  outputs: []
}
