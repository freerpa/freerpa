/**
 * @file: 数据读取节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import { getModelData } from '@dataModule'
const execute = async (node, context) => {
  const { config, store } = node
  const { complete } = context
  try {
    const {
      modelId,
      conditions = [],
      startPage = 1,
      autoPage = false,
      batchSize = 100,
      random = false,
      sort = [],
      readFields = []
    } = config

    // 确保conditions是数组
    const conditionList = Array.isArray(conditions) ? conditions : []
    const conditionObj = Object.fromEntries(
      conditionList.map((condition) => [
        `${condition.field}`,
        {
          operator: condition.operator,
          value: condition.value
        }
      ])
    )

    const getData = async (currentPage) => {
      let _sort = sort.filter((item) => item.field && item.order)
      if (random) {
        _sort = [{ field: 'RANDOM()' }]
      }
      return getModelData({
        modelId,
        page: currentPage,
        pageSize: batchSize,
        filters: conditionObj,
        sort: _sort,
        readFields: readFields.map((item) => item.field)
      })
    }
    if (autoPage) {
      if (!store.currentPage) {
        store.currentPage = startPage
      }
      let { data, total } = await getData(store.currentPage)
      if (total === 0) {
        data = []
      } else {
        // 更新页码
        store.currentPage = data?.length && store.currentPage + 1
      }
      complete({
        data: data,
        dataLength: data.length,
        total: total,
        query: { modelId, ids: data.map((item) => item.id) || [] }
      })
    }
    // 单次读取模式
    else {
      let { data, total } = await getData(1)
      if (total === 0) {
        data = []
      }
      complete({
        data: data,
        dataLength: data.length,
        total: total,
        query: { modelId, ids: data.map((item) => item.id) || [] }
      })
    }
  } catch (error) {
    throw error
  }
}

export default execute
