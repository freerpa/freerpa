/**
 * @file: 数据读取节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import { getModelData } from '@dataModule'
const execute = async (node, context) => {
  const { config } = node
  const { complete } = context
  try {
    const {
      modelId,
      conditions = [],
      startPage = 1,
      batchSize = 100,
      random = false,
      sort = [],
      readFields = []
    } = config

    const getData = async (currentPage) => {
      let _sort = sort.filter((item) => item.field && item.order)
      if (random) {
        _sort = [{ field: 'RANDOM()' }]
      }
      return getModelData({
        modelId,
        page: currentPage,
        pageSize: batchSize,
        conditions: conditions,
        sort: _sort,
        readFields: readFields.map((item) => item.field)
      })
    }
    let { data, total } = await getData(startPage)
    if (total === 0) {
      data = []
    }
    complete({
      data: data,
      dataLength: data.length,
      total: total,
      query: { modelId, ids: data.map((item) => item.id) || [] }
    })
  } catch (error) {
    throw error
  }
}

export default execute
