/**
 * @file: 工作流节点执行器
 */
import { processParams } from '@/common'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, executeSubFlow } = context
  
  const { params = [], config: configParams = [] } = config
  //输入处理（没有输入参数，直接使用默认值）
  const inputsOutputs = processParams(params, inputs)
  //配置参数处理（取对应类型值）
  const configOutputs = configParams.reduce((acc, param) => {
    acc[param.name] = param[param.type + 'Value']
    return acc
  }, {})
  const outputs = await executeSubFlow({ ...inputsOutputs, ...configOutputs })
  complete(outputs)

}

export default execute
