/**
 * @file: 数据过滤节点执行器
 */
import dayjs from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js'
import isBetween from 'dayjs/plugin/isBetween.js'
import weekOfYear from 'dayjs/plugin/weekOfYear.js'

// 注册插件
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)
dayjs.extend(isBetween)
dayjs.extend(weekOfYear)

// 检查单个值是否匹配规则
const checkValue = (value, rule) => {
  const { dataPath, operator, value: ruleValue, startDate, endDate, customCode, regex } = rule
  let fieldValue
  if (dataPath) {
    fieldValue = dataPath.split('.').reduce((obj, key) => obj?.[key], value)
  } else {
    fieldValue = value
  }

  // 根据操作符进行比较
  switch (operator) {
    // 基础比较（严格类型：数值与字符串先统一转为数字再比，避免 '1' == 1 宽松误判）
    case 'eq':
      return compareValues(fieldValue, ruleValue)
    case 'ne':
      return !compareValues(fieldValue, ruleValue)
    case 'gt':
      return Number(fieldValue) > Number(ruleValue)
    case 'gte':
      return Number(fieldValue) >= Number(ruleValue)
    case 'lt':
      return Number(fieldValue) < Number(ruleValue)
    case 'lte':
      return Number(fieldValue) <= Number(ruleValue)

    // 字符串特有比较
    case 'contains':
      if (Array.isArray(ruleValue)) {
        return ruleValue.some((item) => String(fieldValue).includes(item))
      }
      return String(fieldValue).includes(ruleValue)
    case 'notContains':
      if (Array.isArray(ruleValue)) {
        return !ruleValue.some((item) => String(fieldValue).includes(item))
      }
      return !String(fieldValue).includes(ruleValue)
    case 'startsWith':
      return String(fieldValue).startsWith(ruleValue)
    case 'endsWith':
      return String(fieldValue).endsWith(ruleValue)
    case 'regex':
      try {
        return new RegExp(regex).test(String(fieldValue))
      } catch {
        return false
      }

    // 通用比较
    case 'isNull':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    case 'isNotNull':
      return !(fieldValue === null || fieldValue === undefined || fieldValue === '')

    // 日期特有比较
    case 'before':
      return dayjs(fieldValue).isBefore(dayjs(startDate))
    case 'after':
      return dayjs(fieldValue).isAfter(dayjs(startDate))
    case 'between': {
      const start = dayjs(startDate)
      const end = dayjs(endDate)
      return dayjs(fieldValue).isBetween(start, end)
    }
    case 'today':
      return dayjs(fieldValue).isSame(dayjs(), 'day')
    case 'thisWeek':
      return dayjs(fieldValue).isSame(dayjs(), 'week')
    case 'thisMonth':
      return dayjs(fieldValue).isSame(dayjs(), 'month')
    case 'thisYear':
      return dayjs(fieldValue).isSame(dayjs(), 'year')
    case 'custom':
      try {
        // deno worker 内直接执行（沙箱由 deno 权限模型保证），customCode 为函数体，data 为参数
        return new Function('data', customCode)(fieldValue)
      } catch (error) {
        console.error('自定义过滤函数执行错误:', error)
        return false
      }
    default:
      return false
  }
}

// 严格比较：均为数字时按数值比，否则统一转字符串比（避免 '1' == 1 宽松误判）
const compareValues = (a, b) => {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) return false
  if (typeof a === 'number' && typeof b === 'number') return a === b
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
  if (!isNaN(Number(a)) && !isNaN(Number(b)) && String(a).trim() !== '' && String(b).trim() !== '') {
    return Number(a) === Number(b)
  }
  return String(a) === String(b)
}

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  
  const { rules = [], matchType = 'and' } = config
  let data = inputs.data
  if (!Array.isArray(data)) {
    data = [data]
  }
  // 过滤数据
  const result = data.filter((item) => {
    if (matchType === 'and') {
      return rules.every((rule) => checkValue(item, rule))
    } else {
      return rules.some((rule) => checkValue(item, rule))
    }
  })

  // 完成节点
  complete({
    data: result
  })

}

export default execute
