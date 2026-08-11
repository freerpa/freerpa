/**
 * @file: 数据修改节点执行器
 */

import { updateModelData } from '@dataModule'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  const { modelId, ids } = inputs.query
  const updateItems = config.updateItems
  const updateObj = Object.fromEntries(updateItems.map((item) => [`${item.field}`, item.value]))
  
  // 执行更新
  const result = await updateModelData({
    modelId,
    ids,
    data: updateObj
  })
  // 完成节点
  complete({
    count: result?.changes || 0
  })

}

export default execute
