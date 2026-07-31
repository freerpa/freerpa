/**
 * @file: 时间处理节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { Ri24HoursLine } from '@remixicon/vue'

export default {
  type: 'timeHandle',
  name: '时间处理',
  icon: Ri24HoursLine,
  description: '对时间进行转换和加减操作',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        handleType: {
          id: 'handleType',
          name: '处理类型',
          description: '要处理的时间类型',
          type: 'select',
          default: 'toTimestamp',
          required: false,
          quickConfig: true,
          options: [
            {
              label: '转为时间戳',
              value: 'toTimestamp'
            },
            {
              label: '格式化时间',
              value: 'format'
            },
            {
              label: '时间加减',
              value: 'subtractTime'
            }
          ]
        },
        format: {
          id: 'format',
          name: '格式',
          description: '时间格式化字符串，例如：YYYY-MM-DD HH:mm:ss',
          type: 'string',
          default: 'YYYY-MM-DD HH:mm:ss',
          show: '${handleType} === "format"',
          required: true,
          quickConfig: true
        }
        , 
        amount: {
          id: 'amount',
          name: '数值',
          description: '时间加减数值，负数表示减去',
          type: 'number',
          default: 1,
          show: '${handleType} === "subtractTime"',
          required: true,
          quickConfig: true
        }
        , 
        unit: {
          id: 'unit',
          name: '单位',
          description: '时间加减单位',
          type: 'select',
          default: 'hour',
          required: true,
          quickConfig: true,
          show: '${handleType} === "subtractTime"',
          options: [
            {
              label: '年',
              value: 'year'
            },
            {
              label: '月',
              value: 'month'
            },
            {
              label: '周',
              value: 'week'
            },
            {
              label: '天',
              value: 'day'
            },
            {
              label: '时',
              value: 'hour'
            },
            {
              label: '分',
              value: 'minute'
            },
            {
              label: '秒',
              value: 'second'
            }
          ]
        }
      }
    }
  },
  inputs: [
    {
      id: 'time',
      name: '时间',
      type: ['string', 'number'],
      required: true,
      description: '时间'
    }
  ],
  outputs: [
    {
      id: 'time',
      name: '时间',
      type: ['string', 'number'],
      description: '时间'
    }
  ]
}