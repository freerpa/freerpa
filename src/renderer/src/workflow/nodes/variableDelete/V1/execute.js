/**
 * @file: 删除变量节点执行器
 * @description: 从全局变量存储（context.global.variables）删除指定变量。
 */
const execute = async (node, context) => {
  const { config } = node
  const { complete, global } = context
  const { variables = [] } = config

  if (global.variables) {
    variables.forEach((item) => {
      if (item?.name) {
        delete global.variables[item.name]
      }
    })
  }

  complete()
}

export default execute
