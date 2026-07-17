export default {
  label: '对象',
  handlers: {
    length: {
      label: '取长度',
      input: ['object'],
      params: [],
      output: 'number',
      description: '返回对象的属性数量',
      handler: (data) => {
        return Object.keys(data).length
      },
    },
    get: {
      label: '取出属性值',
      input: ['object'],
      description: '取对象中指定属性的属性值',
      params: [
        {
          id: 'key',
          name: '属性名',
          description: '要取的属性名',
          default: '',
          type: 'string',
          required: true
        }
      ],
      output: 'any',
      handler: (data, { key }) => {
        return data[key]
      }
    },
    set: {
      label: '设置属性值',
      input: ['object'],
      description: '设置对象中指定属性的属性值',
      params: [
        {
          id: 'key',
          name: '属性名',
          description: '要设置的属性名',
          default: '',
          type: 'string',
          required: true
        },
        {
          id: 'value',
          name: '属性值',
          description: '要设置的属性值',
          default: '',
          type: 'any',
          required: true
        }
      ],
      output: 'object',
      handler: (data, { key, value }) => {
        data[key] = value
        return data
      }
    },
    keys: {
      label: '取所有属性名',
      input: ['object'],
      description: '返回对象的所有属性名数组',
      params: [],
      output: 'array',
      handler: (data) => {
        return Object.keys(data)
      }
    },
    values: {
      label: '取所有属性值',
      input: ['object'],
      description: '返回对象的所有属性值数组',
      params: [],
      output: 'array',
      handler: (data) => {
        return Object.values(data)
      }
    },
    has: {
      label: '属性是否存在',
      input: ['object'],
      description: '检查对象是否包含指定属性',
      params: [
        {
          id: 'key',
          name: '属性名',
          description: '要检查的属性名',
          default: '',
          type: 'string',
          required: true
        }
      ],
      output: 'boolean',
      handler: (data, { key }) => {
        return data.hasOwnProperty(key)
      }
    },
    delete: {
      label: '删除属性',
      input: ['object'],
      description: '删除对象中指定属性',
      params: [
        {
          id: 'key',
          name: '属性名',
          description: '要删除的属性名',
          default: '',
          type: 'string',
          required: true
        }
      ],
      output: 'object',
      handler: (data, { key }) => {
        delete data[key]
        return data
      }
    },
    clear: {
      label: '清空对象',
      input: ['object'],
      description: '清空对象所有属性',
      params: [],
      output: 'object',
      handler: (data) => {
        Object.keys(data).forEach(key => delete data[key])
        return data
      }
    },
    toString: {
      label: '转文本',
      input: ['object'],
      description: '将对象转换为JSON字符串',
      params: [],
      output: 'string',
      handler: (data) => {
        return JSON.stringify(data)
      }
    }
  }
}
