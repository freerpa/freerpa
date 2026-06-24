/**
 * @file: 调试输出节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { inputs } = node
  const { sendNodeEvent, complete } = context

  try {
    let data = inputs.data
    if (data === undefined) {
      data = 'undefined'
    }
    // 发送输出事件到渲染进程
    sendNodeEvent({
      type: 'output',
      data: {
        data: JSON.stringify(data, null, 2)
      }
    })

    complete()
  } catch (error) {
    throw error
  }
}

export default execute
