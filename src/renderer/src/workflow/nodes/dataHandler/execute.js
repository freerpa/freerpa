/**
 * @file: 数据处理节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */

// 数组操作处理器
const arrayHandlers = {
  // 数组去重
  unique: (data) => {
    return Array.from(new Set(data))
  },

  // 数组分组
  group: (data, config) => {
    const field = config.groupField
    if (!field) return data
    return data.reduce((groups, item) => {
      const key = field.split('.').reduce((obj, key) => obj?.[key], item)
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
      return groups
    }, {})
  },

  // 数组扁平化
  flat: (data) => {
    return data.flat(Infinity)
  },

  // 数组截取
  slice: (data, config) => {
    const { sliceStart = 0, sliceEnd } = config
    return data.slice(sliceStart, sliceEnd)
  },

  // 数组合并
  join: (data, config) => {
    const { joinSeparator = '' } = config
    return data.join(joinSeparator)
  },

  // 取数组长度
  length: (data) => {
    return data.length
  }
}

// 字符串操作处理器
const stringHandlers = {
  // 截取字符串
  substring: (data, config) => {
    const { start = 0, end } = config
    return data.substring(start, end)
  },

  // 替换字符串
  replace: (data, config) => {
    const { searchValue, replaceValue = '' } = config
    if (!searchValue) return data
    return data.replaceAll(searchValue, replaceValue)
  },

  // 分割字符串
  split: (data, config) => {
    const { separator } = config
    if (!separator) return [data]
    return data.split(separator)
  },

  // 转换大小写
  case: (data, config) => {
    switch (config.caseType) {
      case 'upper':
        return data.toUpperCase()
      case 'lower':
        return data.toLowerCase()
      case 'capitalize':
        return data.charAt(0).toUpperCase() + data.slice(1).toLowerCase()
      default:
        return data
    }
  },

  // 去除空格
  trim: (data) => {
    return data.trim()
  },
  //取长度
  length: (data) => {
    return data.length
  }
}

// 数值操作处理器
const numberHandlers = {
  // 四则运算
  arithmetic: (data, config) => {
    const { operator, operand } = config
    if (operand == null) return data
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
  },

  // 取整
  round: (data, config) => {
    switch (config.roundType) {
      case 'round':
        return Math.round(data)
      case 'ceil':
        return Math.ceil(data)
      case 'floor':
        return Math.floor(data)
      default:
        return data
    }
  },

  // 取绝对值
  abs: (data) => {
    return Math.abs(data)
  },

  // 保留小数
  toFixed: (data, config) => {
    const { digit } = config
    return data.toFixed(digit)
  }
}

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, runCode } = context

  try {
    const { type } = config
    let data = inputs.data

    // 如果输入为空,直接返回
    if (data === undefined || data === null) {
      complete({ data: null })
      return
    }

    // 根据类型选择处理器
    switch (type) {
      case 'array': {
        if (!Array.isArray(data)) return data
        const { arrayOperation } = config
        const handler = arrayHandlers[arrayOperation]
        if (handler) {
          data = handler(data, config)
        }
        break
      }

      case 'string': {

        if (typeof data !== 'string') return data
        const { stringOperation } = config
        const handler = stringHandlers[stringOperation]
        if (handler) {
          data = handler(data, config)
        }
        break
      }

      case 'number': {
        if (typeof data !== 'number') return data
        const { numberOperation } = config
        const handler = numberHandlers[numberOperation]
        if (handler) {
          data = handler(data, config)
        }
        break
      }

      case 'custom': {
        try {
          data = runCode(`(function(){${config.customCode}})()`, { data })
        } catch (error) {
          console.error('自定义处理函数执行错误:', error)
        }
        break
      }
    }

    // 返回处理结果
    complete({ data })
  } catch (error) {
    throw error
  }
}

export default execute
