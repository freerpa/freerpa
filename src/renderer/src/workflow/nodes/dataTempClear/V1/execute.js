/**
 * @file: 清空数据暂存节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { inputs } = node
  const { complete } = context

  try {
    inputs.tempStore()
    complete()
  } catch (error) {
    throw error
  }
}

export default execute
