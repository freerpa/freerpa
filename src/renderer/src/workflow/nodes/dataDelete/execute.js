/**
 * @file: 数据删除节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import { deleteModelData } from '@dataModule'
const execute = async (node, context) => {
  const { inputs } = node
  const { complete } = context

  const { modelId, ids } = inputs.query

  try {
    await deleteModelData({
      modelId,
      ids
    })
    // 完成节点
    complete()
  } catch (error) {
    throw error
  }
}

export default execute