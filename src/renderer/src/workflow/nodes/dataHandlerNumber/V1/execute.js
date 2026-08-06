/**
 * @file: 数字数据处理节点执行器
 * @description: 单类型收敛：仅处理本类型 handler（节点自包含，不再依赖 dataHandlers 目录与 worker-common.executeDataHandler）
 */
import { HANDLERS } from './handlers.js'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  // 单类型节点：直接按 handle 取本类型 handler（不再依赖 config.type 与全局 getHandler）
  const handler = HANDLERS[config.handle]
  let result = inputs.data
  if (handler) {
    result = handler.handler(result, config)
  }
  complete({ result })
}

export default execute
