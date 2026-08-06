/**
 * @file: 值格式化（dataExtract / dataParser 共用，避免双份实现漂移）
 * custom 分支经 runCode 执行用户自定义格式化
 */
import dayjs from 'dayjs'

/** 格式化数据 */
export const formatValue = (value, source, format, runCode) => {
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
