/**
 * @file: 触发器节点执行器
 */

import { processParams } from '@/common'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { stopWorkflow, runCode } = context

  
  const { params = [] } = config
  stopWorkflow(processParams(params, inputs, runCode))

}

export default execute
