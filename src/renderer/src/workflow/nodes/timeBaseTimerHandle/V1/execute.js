/**
 * @file: 计时器操作节点执行器
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  const { type } = config
  
  if (type === 'clear') {
    inputs.timer.clear()
  } else if (type === 'start') {
    inputs.timer.start()
  } else if (type === 'stop') {
    inputs.timer.stop()
  }
  complete()

}

export default execute
