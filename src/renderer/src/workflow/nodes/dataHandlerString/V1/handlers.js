// string 类型 handler 集合
// 单类型收敛：自 dataHandlers/types/string.js 迁入（boolean/time 已删除），节点自包含
export const HANDLERS = {
    length: {
      label: '取长度',
      input: ['string'],
      params: [],
      output: 'number',
      description: '返回字符串的长度',
      handler: (data) => {
        return data.length
      },
    },
    replace: {
      label: '替换文本',
      input: ['string'],
      description: '替换字符串中的文本',
      params: [
        {
          id: 'searchValue',
          name: '搜索值',
          description: '要搜索的文本',
          type: 'string',
          required: true
        },
        {
          id: 'replaceValue',
          name: '替换值',
          description: '要替换的文本',
          type: 'string',
          required: false
        },
        {
          id: 'all',
          name: '全部替换',
          description: '是否全部替换,默认仅替换第一个',
          type: 'switch',
          required: false
        }
      ],
      output: 'string',
      handler: (data, { searchValue, replaceValue = '', all = false }) => {
        if (!searchValue) return data
        return all ? data.replaceAll(searchValue, replaceValue) : data.replace(searchValue, replaceValue)
      }
    },
    toUpperCase: {
      label: '转大写',
      input: ['string'],
      description: '将字符串转换为大写',
      params: [],
      output: 'string',
      handler: (data) => {
        return data.toUpperCase()
      }
    },
    toLowerCase: {
      label: '转小写',
      input: ['string'],
      description: '将字符串转换为小写',
      params: [],
      output: 'string',
      handler: (data) => {
        return data.toLowerCase()
      }
    },
    trim: {
      label: '去除空格',
      input: ['string'],
      description: '去除字符串两端的空格',
      params: [],
      output: 'string',
      handler: (data) => {
        return data.trim()
      }
    },
    substring: {
      label: '截取文本',
      input: ['string'],
      description: '截取文本中的文本，负数表示从末尾开始计数',
      params: [
        {
          id: 'start',
          name: '开始索引',
          description: '截取文本的开始索引',
          type: 'number',
          default: 0,
          min: 0,
          required: true
        },
        {
          id: 'end',
          name: '结束索引',
          description: '截取文本的结束索引',
          type: 'number',
          default: 0,
          required: true
        }
      ],
      output: 'string',
      handler: (data, { start, end }) => {
        return data.substring(start, end <= 0 ? data.length + end : end)
      }
    },
    split: {
      label: '分割文本',
      input: ['string'],
      description: '根据分隔符分割文本',
      params: [
        {
          id: 'separator',
          name: '分隔符',
          description: '用于分割文本的分隔符',
          type: 'string',
          default: '',
          required: true
        }
      ],
      output: 'array',
      handler: (data, { separator = '' }) => {
        return data.split(separator)
      }
    },
    toNumber: {
      label: '转数字',
      input: ['string'],
      description: '将字符串转换为数字',
      params: [],
      output: 'number',
      handler: (data) => {
        return Number(data) || 0
      }
    },
    concat: {
      label: '拼接文本',
      input: ['string'],
      description: '拼接多个文本',
      params: [
        {
          id: 'strings',
          name: '文本',
          description: '要拼接的文本列表',
          type: 'array',
          fields: [
            {
              id: 'string',
              name: '',
              type: 'string',
              default: ''
            }
          ],
          default: [],
          required: true
        }
      ],
      output: 'string',
      handler: (data, { strings = [] }) => {
        return data + strings.map(item => item.string).join('')
      }
    },
    indexOf: {
      label: '查找文本位置',
      input: ['string'],
      description: '查找文本中指定文本的索引',
      params: [
        {
          id: 'searchValue',
          name: '文本',
          description: '要搜索的文本',
          type: 'string',
          required: true
        }
      ],
      output: 'number',
      handler: (data, { searchValue }) => {
        return data.indexOf(searchValue)
      }
    },
    includes: {
      label: '包含文本',
      input: ['string'],
      description: '判断文本是否包含指定文本',
      params: [
        {
          id: 'searchValue',
          name: '文本',
          description: '要判断是否包含的文本',
          type: 'string',
          required: true
        }
      ],
      output: 'boolean',
      handler: (data, { searchValue }) => {
        return data.includes(searchValue)
      }
    },
    toJSON: {
      label: '转JSON',
      input: ['string'],
      description: '将字符串转换为JSON对象',
      params: [],
      output: 'object',
      handler: (data) => {
        return JSON.parse(data)
      }
    }

}
