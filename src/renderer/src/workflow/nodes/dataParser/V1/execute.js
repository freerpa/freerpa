/**
 * @file: 数据解析节点执行器
 */
import { formatValue } from './formatValue.js'

// 解析数据
const parseData = (source, rules) => {
  // 如果规则为空,则返回源数据
  if (!rules || rules.length === 0) {
    return source
  }

  const result = {}
  for (const { selector, field, format } of rules) {
    try {
      // 获取源数据（路径缺失返回 undefined 而非路径片段；中间 null/undefined 安全短路）
      let data = source
      data = selector.split('.').reduce((obj, key) => obj?.[key], source)

      // 应用格式化
      if (format) {
        data = formatValue(data, source, format)
      }
      result[field] = data
    } catch {
      result[field] = undefined
    }
  }
  return result
}

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  
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


}

export default execute
