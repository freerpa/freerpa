/**
 * @file: 数据过滤节点执行器
 * @author: dabao
 * @date: 2024-03-15
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

let runCode = null

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
    // 基础比较
    case 'eq':
      return fieldValue == ruleValue
    case 'ne':
      return fieldValue != ruleValue
    case 'gt':
      return fieldValue > ruleValue
    case 'gte':
      return fieldValue >= ruleValue
    case 'lt':
      return fieldValue < ruleValue
    case 'lte':
      return fieldValue <= ruleValue

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
      return new RegExp(regex).test(String(fieldValue))

    // 通用比较
    case 'isNull':
      return !fieldValue
    case 'isNotNull':
      return !!fieldValue

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
      return runCode(`(function(){${customCode}})()`, { data: fieldValue })
    default:
      return false
  }
}

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  runCode = context.runCode

  try {
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
  } catch (error) {
    throw error
  }
}

export default execute
