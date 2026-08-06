/**
 * @file: 数据解析节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import { formatValue } from '@renderer/workflow/dataHandlers/formatValue.js'

let runCode = null

// 格式化数据
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
        data = formatValue(data, source, format, runCode)
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
