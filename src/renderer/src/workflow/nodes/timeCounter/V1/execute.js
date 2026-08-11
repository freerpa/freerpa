/**
 * @file: 计数器节点执行器
 */

const execute = async (node, context) => {
  const { config, store } = node
  const { complete, setOutputs, sendNodeEvent } = context
  const { initialValueCount } = config
  // 仅在未初始化时设置初始值（此前 !store.count 在 count=0 时误重置）
  if (store.count === undefined || store.count === null) {
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
  // 用 complete 替代 next：complete = setOutputs + success + next，节点正常结束
  // （此前 next 保持 running，不含 workflowEnd 的流程永不结束）；
  // counter 引用仍存于 nodeOutputs，timeCounterHandle 经 getInputs 照常可取
  complete({
    counter: counter,
    count: store.count
  })
}

export default execute
