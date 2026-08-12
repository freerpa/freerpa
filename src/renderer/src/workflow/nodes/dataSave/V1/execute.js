/**
 * @file: 数据保存节点执行器
 */
import { batchCreateModelData } from '@dataModule'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  
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
  } catch (error) {
    // 保存失败必须上抛，让外层错误处理机制（errorHandle*）接管，避免静默"保存 0 条"
    throw new Error(`数据保存失败: ${error.message}`)
  }
  // 根据lastID和changes  获取数据标识
  const ids = []
  result.forEach((item) => {
    for (let i = 0; i < item.changes; i++) {
      ids.push(item.lastID - i)
    }
  })

  // 完成节点
  complete({
    savedCount: result.length > 0 ? result[0].changes : 0,
    query: { modelId, ids }
  })

}

export default execute
