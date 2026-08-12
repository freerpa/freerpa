/**
 * @file: 计时器操作节点执行器
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  const { type } = config
  
  if (!inputs.timer) {
    throw new Error('请先连接计时器节点（timeBaseTimer）')
  }
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
