/**
 * @file: 数据删除节点执行器
 */
import { deleteModelData } from '@dataModule'
const execute = async (node, context) => {
  const { inputs } = node
  const { complete } = context

  if (!inputs.query) {
    throw new Error('请先连接数据读取节点（dataRead/dataSave）的「数据标识」输出')
  }
  const { modelId, ids } = inputs.query

  
  await deleteModelData({
    modelId,
    ids
  })
  // 完成节点
  complete()

}

export default execute