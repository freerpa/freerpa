/**
 * @file: 设置变量节点执行器
 * @description: 将变量写入全局变量存储（context.global.variables，跨节点/子流程共享）。
 * 每个变量：输入连线值优先，否则取配置默认值（复用 processParams 的类型处理）。
 */
import { processParams } from '@/common'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, global } = context
  const { variables = [] } = config

  // 初始化全局变量存储
  if (!global.variables) {
    global.variables = {}
  }

  // processParams(variables, inputs)：
  // 对每个变量取 inputs[变量名] ?? 配置默认值，并按 type 做类型转换
  const output = processParams(variables, inputs || {})
  Object.assign(global.variables, output)

  complete(output)
}

export default execute
