/**
 * @file: 触发器节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

import { processParams } from '@/common'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { stopWorkflow, runCode } = context

  try {
    const { params = [] } = config
    stopWorkflow(processParams(params, inputs, runCode))
  } catch (error) {
    throw error
  }
}

export default execute
