/**
 * @file: 值格式化（与 dataExtract 的 formatValue.js 保持逐字一致——prod 构建要求节点目录自包含，无法跨目录共享）
 * custom 分支在 deno worker 内直接执行用户自定义格式化（沙箱由 deno 权限模型保证）
 */
import dayjs from 'dayjs'

/** 格式化数据 */
export const formatValue = (value, source, format) => {
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
          // deno worker 内直接执行（沙箱由 deno 权限模型保证），customFormat 为函数体，data/source 为参数
          return new Function('data', 'source', format.customFormat)(value, source)
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
