/**
 * @file: 调试输出节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { inputs, store } = node
  const { complete, setOutputs } = context

  try {
    let data = inputs.data
    if (!store.tempStore) {
      store.tempStore = []
    }
    store.tempStore.push(data)
    const clearTempStore = function () {
      store.tempStore = []
      setOutputs({
        data: store.tempStore,
        length: store.tempStore.length,
        tempStore: clearTempStore
      })
    }
    complete({
      data: store.tempStore,
      length: store.tempStore.length,
      tempStore: clearTempStore
    })
  } catch (error) {
    throw error
  }
}

export default execute
