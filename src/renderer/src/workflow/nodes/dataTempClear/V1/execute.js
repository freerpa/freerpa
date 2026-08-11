/**
 * @file: 清空数据暂存节点执行器
 */

const execute = async (node, context) => {
  const { inputs } = node
  const { complete } = context

  
  inputs.tempStore()
  complete()

}

export default execute
