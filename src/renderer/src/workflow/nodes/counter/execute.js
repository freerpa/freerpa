/**
 * @file: 计数器节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { inputs, store } = node
  const { complete, setOutputs } = context

  try {
    let data = inputs.data
    if (!store.counter) {
      store.counter = 0
    }
    store.counter++
    const clearCounter = function () {
      store.counter = 0
      setOutputs({
        counter: clearCounter,
        count: store.counter
      })
    }
    complete({
      counter: clearCounter,
      count: store.counter
    })
  } catch (error) {
    throw error
  }
}

export default execute
