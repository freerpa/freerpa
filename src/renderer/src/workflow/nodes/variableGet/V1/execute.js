/**
 * @file: 读取变量节点执行器
 * @description: 从全局变量存储（context.global.variables）读取指定变量并输出。
 */
const execute = async (node, context) => {
  const { config } = node
  const { complete, global } = context
  const { variables = [] } = config

  const store = global.variables || {}
  const output = {}
  variables.forEach((item) => {
    if (!item?.name) return
    output[item.name] = store[item.name]
  })

  complete(output)
}

export default execute
