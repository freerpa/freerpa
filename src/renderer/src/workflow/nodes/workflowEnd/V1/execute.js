/**
 * @file: 触发器节点执行器
 */

import { processParams } from '@/common'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { stopWorkflow } = context

  
  const { params = [] } = config
  await stopWorkflow(processParams(params, inputs))

}

export default execute
