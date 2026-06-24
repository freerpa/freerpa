
import dayjs from 'dayjs'
export default {
  label: '时间',
  handlers: {
    format: {
      label: '格式化时间戳',
      input: ['number'],
      description: '将时间戳格式化时间为指定格式',
      params: [
        {
          id: 'format',
          name: '格式',
          description: '例如：YYYY-MM-DD HH:mm:ss',
          type: 'string',
          default: 'YYYY-MM-DD HH:mm:ss',
          required: true
        }
      ],
      output: 'string',
      handler: (data, { format = 'YYYY-MM-DD HH:mm:ss' }) => {
        return dayjs(data).format(format)
      }
    },
    toTimestamp: {
      label: '转为时间戳',
      input: ['string'],
      description: '将格式化时间文本转为时间戳',
      params: [],
      output: 'number',
      handler: (data) => {
        return dayjs(data).unix()
      }
    },
    getNow: {
      label: '取当前时间',
      input: [],
      description: '取当前系统时间',
      params: [
        {
          id: 'timeType',
          name: '时间类型',
          description: '时间类型，例如：time、string',
          type: 'radio',
          default: 'timestamp',
          required: false,
          options: [
            {
              label: '时间戳',
              value: 'timestamp'
            },
            {
              label: '格式化时间',
              value: 'format'
            }
          ]
        },
        {
          id: 'format',
          name: '格式',
          description: '时间格式化字符串，例如：YYYY-MM-DD HH:mm:ss',
          type: 'string',
          default: 'YYYY-MM-DD HH:mm:ss',
          show: '${timeType} === "format"',
          required: true
        }
      ],
      output: ['number', 'string'],
      handler: (data, { timeType = 'timestamp', format = 'YYYY-MM-DD HH:mm:ss' }) => {
        return timeType === 'timestamp' ? dayjs().unix() : dayjs().format(format)
      }
    },
    calculate: {
      label: '计算时间',
      input: ['string'],
      description: '计算时间',
      params: [
        {
          id: 'value',
          name: '变量',
          description: '增减的时间值，例如：增：1、2 减：-1、-2',
          type: 'number',
          default: 0,
          required: true
        },
        {
          id: 'unit',
          name: '单位',
          description: '时间单位',
          type: 'select',
          default: 'd',
          required: true,
          options: [
            {
              label: '天',
              value: 'd'
            },
            {
              label: '小时',
              value: 'h'
            },
            {
              label: '分钟',
              value: 'm'
            },
            {
              label: '秒',
              value: 's'
            }
          ]
        }
      ],
      output: 'string',
      handler: (data, { value = 0, unit = 'd', format = 'YYYY-MM-DD HH:mm:ss' }) => {
        return dayjs(data).add(value, unit).format(format)
      }
    }
  }
}
