/**
 * @file: 计数器节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { config, store } = node
  const { next, setOutputs, sendNodeEvent } = context
  const { initialValueCount } = config
  try {
    if (!store.count) {
      store.count = initialValueCount || 0
    }
    const handleCount = (type) => {
      if (type === 'increase') {
        store.count++
      } else if (type === 'clear') {
        store.count = initialValueCount || 0
      } else if (type === 'reduce') {
        if (store.count > 0) {
          store.count--
        }
      }
      setOutputs({
        count: store.count
      })
      sendNodeEvent({
        type: 'count',
        data: store.count
      })
      return store.count
    }
    const counter = {
      clear: function () {
        return handleCount('clear')
      },
      increase: function () {
        return handleCount('increase')
      },
      reduce: function () {
        return handleCount('reduce')
      }
    }
    sendNodeEvent({
      type: 'count',
      data: store.count
    })
    next({
      counter: counter,
      count: store.count
    })
  } catch (error) {
    throw error
  }
}

export default execute
