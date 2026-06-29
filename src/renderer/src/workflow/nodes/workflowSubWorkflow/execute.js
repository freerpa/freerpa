/**
 * @file: 工作流节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import { processParams } from '@/common'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, executeSubFlow, runCode } = context
  try {
    const { params = [], config: configParams = [] } = config
    //输入处理（没有输入参数，直接使用默认值）
    const inputsOutputs = processParams(params, inputs, runCode)
    //配置参数处理（取对应类型值）
    const configOutputs = configParams.reduce((acc, param) => {
      acc[param.name] = param[param.type + 'Value']
      return acc
    }, {})
    const outputs = await executeSubFlow({ ...inputsOutputs, ...configOutputs })
    complete(outputs)
  } catch (error) {
    throw error
  }
}

export default execute
