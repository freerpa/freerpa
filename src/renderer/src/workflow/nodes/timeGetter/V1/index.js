/**
 * @file: 时间获取节点
 */
import { RiTimeLine } from '@remixicon/vue'

export default {
  type: 'timeGetter',
  name: '时间获取',
  icon: RiTimeLine,
  description: '获取当前时间节点：输出当前时刻的时间，可选择输出格式化时间字符串（按指定格式）或 Unix 时间戳（秒级）。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'timeType',
          name: '时间类型',
          description: '要获取的时间类型：format（按“格式”输出格式化时间字符串）/ timestamp（输出 Unix 时间戳，秒级数字）',
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
        {
          id: 'format',
          name: '格式',
          description: '时间格式化字符串（dayjs 格式），例如：YYYY-MM-DD HH:mm:ss',
          type: 'string',
          default: 'YYYY-MM-DD HH:mm:ss',
          show: '${timeType} === "format"',
          required: true,
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      id: 'time',
      name: '时间',
      type: ['string', 'number'],
      description: '当前时间：格式化时间字符串或 Unix 时间戳（秒级数字）'
    }
  ]
}
