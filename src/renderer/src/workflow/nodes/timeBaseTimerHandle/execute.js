/**
 * @file: 计时器操作节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context
  const { type } = config
  try {
    if (type === 'clear') {
      inputs.timer.clear()
    } else if (type === 'start') {
      inputs.timer.start()
    } else if (type === 'stop') {
      inputs.timer.stop()
    }
    complete()
  } catch (error) {
    throw error
  }
}

export default execute
