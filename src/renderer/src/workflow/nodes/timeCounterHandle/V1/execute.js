/**
 * @file: 操作计数器节点执行器
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  const { type } = config

  
  let count = 0
  if (type === 'clear') {
    count = inputs.counter.clear()
  } else if (type === 'increase') {
    count = inputs.counter.increase()
  } else if (type === 'reduce') {
    count = inputs.counter.reduce()
  }
  complete({
    count: count
  })

}

export default execute
