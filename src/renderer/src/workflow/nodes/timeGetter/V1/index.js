/**
 * @file: 时间获取节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { RiTimeLine } from '@remixicon/vue'

export default {
  type: 'timeGetter',
  name: '时间获取',
  icon: RiTimeLine,
  description: '获取当前时间',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        timeType: {
          id: 'timeType',
          name: '时间类型',
          description: '要获取的时间类型',
          type: 'radio',
          default: 'format',
          required: false,
          quickConfig: true,
          options: [
            {
              label: '格式化时间',
              value: 'format'
            },
            {
              label: '时间戳',
              value: 'timestamp'
            }
          ]
        },
        format: {
          id: 'format',
          name: '格式',
          description: '时间格式化字符串，例如：YYYY-MM-DD HH:mm:ss',
          type: 'string',
          default: 'YYYY-MM-DD HH:mm:ss',
          show: '${timeType} === "format"',
          required: true,
          quickConfig: true
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'time',
      name: '时间',
      type: ['string', 'number'],
      description: '时间'
    }
  ]
}