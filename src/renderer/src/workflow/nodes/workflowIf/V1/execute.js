/**
 * @file: 判断节点执行器
 */
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'

// 加载dayjs插件
dayjs.extend(isBetween)
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)

// 比较函数集合
const operators = {
  // 基础比较
  eq: (data, value) => String(data) === String(value),
  ne: (data, value) => String(data) !== String(value),
  gt: (data, value) => Number(data) > Number(value),
  gte: (data, value) => Number(data) >= Number(value),
  lt: (data, value) => Number(data) < Number(value),
  lte: (data, value) => Number(data) <= Number(value),

  // 字符串操作
  contains: (data, value) => String(data).includes(String(value)),
  notContains: (data, value) => !String(data).includes(String(value)),
  startsWith: (data, value) => String(data).startsWith(String(value)),
  endsWith: (data, value) => String(data).endsWith(String(value)),

  // 空值判断
  isNull: (data) => {
    if(data === null || data === undefined || data === '' || data === 0 || Number.isNaN(data) || data === false) {
      return true
    }else if(Array.isArray(data)) {
      return data.length === 0
    }else if(typeof data === 'object') {
      return Object.keys(data).length === 0
    }else {
      return false
    }
  },
  isNotNull: (data) => {
    return !operators.isNull(data)
  },
  // 布尔值判断
  // 布尔判断：严格匹配布尔值，字符串 'true'/'false' 归一化后判断（避免 0/' '/'' 误判）
  isTrue: (data) => {
    if (typeof data === 'boolean') return data === true
    if (typeof data === 'string') return data.toLowerCase() === 'true'
    return !!data
  },
  isFalse: (data) => {
    if (typeof data === 'boolean') return data === false
    if (typeof data === 'string') return data.toLowerCase() === 'false'
    return !data
  },
  // 正则匹配
  regex: (data, regex) => {
    try {
      return new RegExp(regex).test(String(data))
    } catch (error) {
      console.error('正则表达式错误:', error)
      return false
    }
  },

  // 日期比较
  before: (data, date) => {
    try {
      return dayjs(data).isBefore(dayjs(date))
    } catch {
      return false
    }
  },
  after: (data, date) => {
    try {
      return dayjs(data).isAfter(dayjs(date))
    } catch {
      return false
    }
  },
  between: (data, startDate, endDate) => {
    try {
      return dayjs(data).isBetween(dayjs(startDate), dayjs(endDate), null, '[]')
    } catch {
      return false
    }
  },

  // 特殊日期判断
  today: (data) => {
    try {
      return dayjs(data).isSame(dayjs(), 'day')
    } catch {
      return false
    }
  },
  thisWeek: (data) => {
    try {
      return dayjs(data).isSame(dayjs(), 'week')
    } catch {
      return false
    }
  },
  thisMonth: (data) => {
    try {
      return dayjs(data).isSame(dayjs(), 'month')
    } catch {
      return false
    }
  },
  thisYear: (data) => {
    try {
      return dayjs(data).isSame(dayjs(), 'year')
    } catch {
      return false
    }
  },

  // 自定义判断
  custom: (data, code) => {
    try {
      // deno worker 内直接执行（沙箱由 deno 权限模型保证），code 为函数体，data 为参数
      return new Function('data', code)(data)
    } catch (error) {
      console.error('自定义判断函数执行错误:', error)
      return false
    }
  }
}

// 执行单个规则判断
const executeRule = ({ operator, data, value, startDate, endDate, regex, customCode }) => {
  try {
    // 获取对应的操作函数
    const operatorFn = operators[operator]
    if (!operatorFn) return false

    // 根据不同操作符处理
    switch (operator) {
      case 'between':
        return operatorFn(data, startDate, endDate)
      case 'before':
      case 'after':
        return operatorFn(data, startDate)
      case 'regex':
        return operatorFn(data, regex)
      case 'custom':
        return operatorFn(data, customCode)
      case 'isNull':
      case 'isNotNull':
      case 'today':
      case 'thisWeek':
      case 'thisMonth':
      case 'thisYear':
        return operatorFn(data)
      default:
        return operatorFn(data, value)
    }
  } catch (error) {
    console.error('规则执行错误:', error)
    return false
  }
}

const execute = async (node, context) => {
  const { config } = node
  const { complete } = context
  
  const { matchType = 'and', rules = [] } = config

  // 如果没有规则,默认为true
  if (rules.length === 0) {
    complete({ result: true })
    return
  }

  // 执行所有规则
  const results = rules.map((rule) => executeRule(rule))
  // 根据匹配类型判断最终结果
  const finalResult =
    matchType === 'and' ? results.every((result) => result) : results.some((result) => result)
  // 完成节点
  if (finalResult) {
    complete({ result: true })
  } else {
    complete({ result: false })
  }

}

export default execute
