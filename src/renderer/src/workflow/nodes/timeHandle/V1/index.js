/**
 * @file: 时间处理节点
 */
import { Ri24HoursLine } from '@remixicon/vue'

export default {
  type: 'timeHandle',
  name: '时间处理',
  icon: Ri24HoursLine,
  description: '时间处理节点：对输入的时间执行转换或运算——转为 Unix 时间戳、按指定格式重新格式化，或按单位做时间加减，输出处理后的时间。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'handleType',
          name: '处理类型',
          description: '处理类型：toTimestamp（转为 Unix 时间戳）/ format（按“格式”重新格式化）/ subtractTime（按“数值+单位”做时间加减）',
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
        {
          id: 'format',
          name: '格式',
          description: '时间格式化字符串（dayjs 格式），用于“格式化时间”与“时间加减”的结果输出，例如：YYYY-MM-DD HH:mm:ss',
          type: 'string',
          default: 'YYYY-MM-DD HH:mm:ss',
          show: '${handleType} === "format"',
          required: true,
          quickConfig: true
        }
        , 
        {
          id: 'amount',
          name: '数值',
          description: '时间加减的数值：正数表示增加、负数表示减少（单位见“单位”字段）',
          type: 'number',
          default: 1,
          show: '${handleType} === "subtractTime"',
          required: true,
          quickConfig: true
        }
        , 
        {
          id: 'unit',
          name: '单位',
          description: '时间加减的单位：年/月/周/天/时/分/秒',
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
      ]
    }
  ],
  inputs: [
    {
      id: 'time',
      name: '时间',
      type: ['string', 'number'],
      required: true,
      description: '待处理的时间：格式化时间字符串或 Unix 时间戳（秒级数字）'
    }
  ],
  outputs: [
    {
      id: 'time',
      name: '时间',
      type: ['string', 'number'],
      description: '处理后的时间：字符串（格式化/加减结果）或数字（时间戳）'
    }
  ]
}
