/**
 * @file: 数据创建节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import { processParams } from '@/common'
import { cloneDeep } from 'lodash-es'
const execute = async (node, context) => {
  const { config } = node
  const { complete, runCode } = context

  try {
    const {
      dataModel = []
    } = config
    try {
      const output = processParams(dataModel, {}, runCode)
      for (const key in output) {
        if (typeof output[key] === 'object') {
          output[key] = cloneDeep(output[key])
        }
      }
      // 发送结果
      complete(output)
    } catch (error) {
      throw error
    }
  } catch (error) {
    throw error
  }
}

export default execute
