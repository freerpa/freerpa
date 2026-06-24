/**
 * @file: 全局变量节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

import { processParams } from '@/common'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, runCode, engine } = context

  try {
    const { params = [], config: configParams = [] } = config
    const inputsOutputs = processParams(params, inputs, runCode)
    const configOutputs = configParams.reduce((acc, param) => {
      acc[param.name] = param[param.type + 'Value']
      return acc
    }, {})
    complete({ ...inputsOutputs, ...configOutputs })

  } catch (error) {
    throw error
  }
}

export default execute
