// array 类型 handler 集合
// 单类型收敛：自 dataHandlers/types/array.js 迁入（boolean/time 已删除），节点自包含
export const HANDLERS = {
    length: {
      label: '取长度',
      input: ['array'],
      params: [],
      output: 'number',
      description: '返回数组的长度',
      handler: (data) => {
        return data.length
      },
    },
    get: {
      label: '取出项',
      input: ['array'],
      description: '取数组中指定索引的项',
      params: [
        {
          id: 'index',
          name: '索引',
          description: '要取的项索引 负数表示从数组末尾开始计数',
          default: 0,
          type: 'number',
          required: true
        }
      ],
      output: 'any',
      handler: (data, { index }) => {
        return data[index < 0 ? data.length + index : index]
      }
    },
    add: {
      label: '添加项',
      input: ['array'],
      description: '在数组指定索引位置插入一个项',
      params: [
        {
          id: 'index',
          name: '索引',
          description: '要插入的项索引 负数表示从数组末尾开始计数',
          default: 0,
          type: 'number',
          required: true
        },
        {
          id: 'item',
          name: '项',
          description: '要插入的项',
          default: '',
          type: 'any',
          required: true
        }
      ],
      output: 'array',
      handler: (data, { index, item }) => {
        data.splice(index < 0 ? data.length + index : index, 0, item)
        return data
      }
    },
    remove: {
      label: '删除项',
      input: ['array'],
      description: '删除数组中指定索引的项',
      params: [
        {
          id: 'index',
          name: '索引',
          description: '要删除的项索引 负数表示从数组末尾开始计数',
          default: 0,
          type: 'number',
          required: true
        },
        {
          id: 'count',
          name: '数量',
          description: '要删除的项数量 0表示删除所有项',
          min: 0,
          default: 1,
          type: 'number',
          required: true
        }
      ],
      output: 'array',
      handler: (data, { index, count }) => {
        if (count === 0) {
          data.length = 0
        } else {
          data.splice(index < 0 ? data.length + index : index, count)
        }
        return data
      }
    },

    flatten: {
      label: '扁平化数组',
      input: ['array'],
      description: '将多维数组转换为一维数组',
      params: [],
      output: 'array',
      handler: (data) => {
        return data.flat()
      }
    },
    join: {
      label: '连接数组',
      input: ['array'],
      description: '将数组连接为文本',
      params: [
        {
          id: 'connector',
          name: '连接符',
          description: '用于连接数组项的文本',
          type: 'string',
          default: ','
        }
      ],
      output: 'string',
      handler: (data, { connector = ',' }) => {
        return data.join(connector)
      }
    },
    group: {
      label: '分组数组',
      input: ['array'],
      description: '将数组按指定字段分组',
      params: [
        {
          id: 'field',
          name: '分组字段',
          description: '根据指定字段分组',
          default: '',
          type: 'string',
          required: true
        }
      ],
      output: 'object',
      handler: (data, { field }) => {
        if (!field) return data
        return data.reduce((groups, item) => {
          const key = field.split('.').reduce((obj, key) => obj?.[key], item)
          if (!groups[key]) {
            groups[key] = []
          }
          groups[key].push(item)
          return groups
        }, {})
      }
    },
    sort: {
      label: '排序数组',
      input: ['array'],
      description: '对数组进行排序',
      params: [
        {
          id: 'field',
          name: '排序字段',
          description: '根据指定字段排序',
          default: '',
          type: 'string',
          required: true
        }
      ],
      output: 'array',
      handler: (data, { field }) => {
        if (!field) return data
        return data.sort((a, b) => {
          const keyA = field.split('.').reduce((obj, key) => obj?.[key], a)
          const keyB = field.split('.').reduce((obj, key) => obj?.[key], b)
          if (keyA < keyB) return -1
          if (keyA > keyB) return 1
          return 0
        })
      }
    },
    reverse: {
      label: '反转数组',
      input: ['array'],
      description: '将数组项顺序反转',
      params: [],
      output: 'array',
      handler: (data) => {
        return data.reverse()
      }
    },
    unique: {
      label: '去重数组',
      input: ['array'],
      description: '从数组中移除重复项',
      params: [],
      output: 'array',
      handler: (data) => {
        return [...new Set(data)]
      }
    },
    slice: {
      label: '截取数组',
      input: ['array'],
      description: '从数组中提取指定范围的项',
      params: [
        {
          id: 'start',
          name: '起始索引',
          description: '提取的起始索引',
          default: 0,
          min: 0,
          type: 'number',
          required: true
        },
        {
          id: 'end',
          name: '结束索引',
          description: '提取的结束索引（不包含）负数表示从数组末尾开始计数',
          default: 0,
          type: 'number',
          required: true
        }
      ],
      output: 'array',
      handler: (data, { start, end }) => {
        return data.slice(start, end <= 0 ? data.length + end : end)
      }
    },
    toString: {
      label: '转文本',
      input: ['array'],
      description: '将数组转换为JSON字符串',
      params: [],
      output: 'string',
      handler: (data) => {
        return JSON.stringify(data)
      }
    }
}
