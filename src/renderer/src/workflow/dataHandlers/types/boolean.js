export default {
  label: '是否',
  handlers: {
    assign: {
      label: '赋值',
      input: ['boolean'],
      params: [
        {
          id: 'value',
          name: '值',
          description: '要赋值的是否值',
          type: 'switch'
        }
      ],
      output: 'boolean',
      description: '将是否值赋值给变量',
      handler: (data, { value }) => {
        data = value
        return data
      },
    },
    toString: {
      label: '转文本',
      input: ['boolean'],
      params: [],
      output: 'string',
      description: '将是否值转换为字符串',
      handler: (data) => {
        return data.toString()
      }
    },
    toNumber: {
      label: '转数字',
      input: ['boolean'],
      params: [],
      output: 'number',
      description: '将是否值转换为数字',
      handler: (data) => {
        return Number(data)
      }
    }
  }
}
