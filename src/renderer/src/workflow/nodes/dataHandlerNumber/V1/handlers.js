// number 类型 handler 集合
// 单类型收敛：自 dataHandlers/types/number.js 迁入（boolean/time 已删除），节点自包含
export const HANDLERS = {
    calculate: {
      label: '运算',
      input: ['number'],
      params: [
        {
          id: 'operator',
          name: '运算符',
          description: '要进行的运算',
          default: '+',
          type: 'select',
          options: [
            {
              label: '加',
              value: '+'
            },
            {
              label: '减',
              value: '-'
            },
            {
              label: '乘',
              value: '*'
            },
            {
              label: '除',
              value: '/'
            },
            {
              label: '取余',
              value: '%'
            }
          ],
          required: true
        },
        {
          id: 'operand',
          name: '操作数',
          description: '要进行运算的操作数',
          default: 0,
          type: 'number',
          required: true
        }
      ],
      output: 'number',
      description: '对数字进行运算',
      handler: (data, { operator, operand }) => {
        switch (operator) {
          case '+':
            return data + operand
          case '-':
            return data - operand
          case '*':
            return data * operand
          case '/':
            return operand === 0 ? data : data / operand
          case '%':
            return data % operand
          default:
            return data
        }
      }
    },
    round: {
      label: '四舍五入',
      input: ['number'],
      params: [],
      output: 'number',
      description: '将数字四舍五入到最近的整数',
      handler: (data) => {
        return Math.round(data)
      }
    },
    floor: {
      label: '向下取整',
      input: ['number'],
      params: [],
      output: 'number',
      description: '将数字向下取整到最近的整数',
      handler: (data) => {
        return Math.floor(data)
      }
    },
    ceil: {
      label: '向上取整',
      input: ['number'],
      params: [],
      output: 'number',
      description: '将数字向上取整到最近的整数',
      handler: (data) => {
        return Math.ceil(data)
      }
    },
    abs: {
      label: '取绝对值',
      input: ['number'],
      params: [],
      output: 'number',
      description: '返回数字的绝对值',
      handler: (data) => {
        return Math.abs(data)
      }
    },
    pow: {
      label: '取幂',
      input: ['number'],
      params: [
        {
          id: 'exponent',
          name: '指数',
          description: '要取幂的指数',
          default: 0,
          type: 'number',
          required: true
        }
      ],
      output: 'number',
      description: '返回数字的指数次幂',
      handler: (data, { exponent }) => {
        return Math.pow(data, exponent)
      }
    },
    sqrt: {
      label: '取平方根',
      input: ['number'],
      params: [],
      output: 'number',
      description: '返回数字的平方根',
      handler: (data) => {
        return Math.sqrt(data)
      }
    },
    random: {
      label: '取随机数',
      input: [],
      params: [
        {
          id: 'min',
          name: '最小值',
          description: '随机数的最小值',
          default: 0,
          type: 'number',
          required: true
        },
        {
          id: 'max',
          name: '最大值',
          description: '随机数的最大值',
          default: 1,
          type: 'number',
          required: true
        }
      ],
      output: 'number',
      description: '返回指定范围内的随机数',
      handler: (data, { min, max }) => {
        return Math.floor(Math.random() * (max - min + 1) + min)
      }
    },
    mean: {
      label: '取平均值',
      input: ['array'],
      params: [],
      output: 'number',
      description: '返回多个数字的平均值',
      handler: (data) => {
        return data.reduce((acc, cur) => acc + cur, 0) / data.length
      }
    },
    max: {
      label: '取最大值',
      input: ['array'],
      params: [],
      output: 'number',
      description: '返回多个数字中的最大值',
      handler: (data) => {
        return Math.max(...data)
      }
    },
    min: {
      label: '取最小值',
      input: ['array'],
      params: [],
      output: 'number',
      description: '返回多个数字中的最小值',
      handler: (data) => {
        return Math.min(...data)
      }
    }
}
