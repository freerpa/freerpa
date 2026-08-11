/**
 * @file: 数据删除节点执行器
 */
import { deleteModelData } from '@dataModule'
const execute = async (node, context) => {
  const { inputs } = node
  const { complete } = context

  const { modelId, ids } = inputs.query

  
  await deleteModelData({
    modelId,
    ids
  })
  // 完成节点
  complete()

}

export default execute