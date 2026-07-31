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
  for (const { selector, field, format } of rules) {
    try {
      // 获取源数据数组
      let data = source
      data = selector.split('.').reduce((obj, key) => obj.hasOwnProperty(key) ? obj[key] : key, source)

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
    const { dataPath, rules = [], onlyValue = false } = config

    let data = inputs.data

    if (dataPath) {
      data = dataPath.split('.').reduce((obj, key) => obj?.[key], data)
    }

    if (!data) {
      complete({
        data
      })
      return
    }

    try {
      let result = {}
      if (Array.isArray(data)) {
        result = []
        for (const item of data) {
          let resultItem = parseData(item, rules)
          // 如果只有一个字段，并且字段名称为空，则将结果设置为该字段的值
          if (onlyValue && Object.keys(resultItem).length === 1) {
            resultItem = resultItem[Object.keys(resultItem)[0]]
          }
          result.push(resultItem)
        }
      } else {
        // 执行解析
        result = parseData(data, rules)
        // 如果只有一个字段，并且字段名称为空，则将结果设置为该字段的值
        if (onlyValue && Object.keys(result).length === 1) {
          result = result[Object.keys(result)[0]]
        }
      }

      // 发送结果
      complete({
        data: result
      })
    } catch (error) {
      throw error
    }
  } catch (error) {
    throw error
  }
}

export default execute
