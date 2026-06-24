/**
 * @file: 数据解析节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import dayjs from 'dayjs'

let runCode = null

// 格式化数据
const formatValue = (value, source, format) => {
  if (!format || !format.type || format.type === 'none') return value

  try {
    switch (format.type) {
      case 'time': {
        const date = new Date(value)
        if (format.pattern) {
          return dayjs(date).format(format.pattern)
        }
        return date.toLocaleString('zh-CN')
      }

      case 'currency': {
        let price = parseFloat(value)
          .toFixed(format.precision || 0)
          .toString()
        if (format.separator) {
          price = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        }
        switch (format.currency) {
          case 'CNY':
            return `¥${price}`
          case 'USD':
            return `$${price}`
          case 'EUR':
            return `€${price}`
          case 'GBP':
            return `£${price}`
          default:
            return price
        }
      }

      case 'number': {
        const num = parseFloat(value)
        return num.toFixed(format.precision || 0)
      }

      case 'percentage': {
        const num = parseFloat(value)
        return `${(num * 100).toFixed(format.precision || 0)}%`
      }

      case 'filesize': {
        const bytes = parseInt(value)
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        let size = bytes
        let unit = 0
        while (size >= 1024 && unit < units.length - 1) {
          size /= 1024
          unit++
        }
        return `${size.toFixed(2)} ${units[unit]}`
      }

      case 'custom': {
        if (format.customFormat) {
          return runCode(`(function(){${format.customFormat}})()`, { data: value, source })
        }
        return value
      }

      default:
        return value
    }
  } catch (error) {
    console.error('格式化失败:', error)
    return value
  }
}

// 解析数据
const parseData = (source, rules) => {
  // 如果规则为空,则返回源数据
  if (!rules || rules.length === 0) {
    return source
  }

  const result = {}
  for (const { field, dataPath, format } of rules) {
    try {
      // 获取源数据数组
      let data = source
      if (dataPath) {
        data = dataPath.split('.').reduce((obj, key) => obj?.[key], source)
      }

      // 应用格式化
      if (format) {
        data = formatValue(data, source, format)
      }
      result[field] = data
    } catch (error) {
      result[field] = 'error:' + error.message
    }
  }
  return result
}

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  runCode = context.runCode

  try {
    const { rules = [] } = config
    try {
      let result = {}
      // 执行解析
      result = parseData(inputs.data, rules)
      // 发送结果
      complete(result)
    } catch (error) {
      throw error
    }
  } catch (error) {
    throw error
  }
}

export default execute
