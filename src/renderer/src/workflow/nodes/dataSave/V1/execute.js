/**
 * @file: 数据保存节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import { batchCreateModelData } from '@dataModule'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  try {
    const { modelId } = config
    let data = inputs.data

    if (!Array.isArray(data)) {
      data = [data]
    }

    // 保存数据
    let result
    try {
      // 批量插入
      result = await batchCreateModelData({
        modelId,
        data: data,
        batchSize: 1000 // 每批次处理的数据量
      })
    } catch (error) {}
    if (!result) result = []
    // 根据lastID和changes  获取数据标识
    const ids = []
    result.forEach((item) => {
      for (let i = 0; i < item.changes; i++) {
        ids.push(item.lastID - i)
      }
    })

    // 完成节点
    complete({
      data: result.length > 0 ? result[0].changes : 0,
      query: { modelId, ids }
    })
  } catch (error) {
    throw error
  }
}

export default execute
