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
  for (const { field, dataPath, format } of rules) {
    try {
      // 获取源数据
      let data = source
      if (dataPath) {
        data = dataPath.split('.').reduce((obj, key) => obj?.[key], source)
      }

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

// 解析数据（数组输入逐条解析，与 dataParser 行为一致）
const parseArray = (items, rules) => items.map((item) => parseData(item, rules))

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  
  const { rules = [] } = config
  
  let result = {}
  // 数组输入逐条解析，否则单条解析（与 inputs 声明的 ['array','object','string'] 对齐）
  result = Array.isArray(inputs.data) ? parseArray(inputs.data, rules) : parseData(inputs.data, rules)
  // 发送结果
  complete(result)


}

export default execute
