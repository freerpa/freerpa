/**
 * @file: 通知节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { config } = node
  const { complete, sendNodeEvent, onBeforeDestroy } = context

  try {
    const { message = "有一条消息" } = config

    // 发送通知事件
    sendNodeEvent({
      type: "notice",
      data: {
        message,
      },
    })
    // 注册清理函数
    onBeforeDestroy(() => {
      sendNodeEvent({
        type: "stop",
      })
    })
    complete()
  } catch (error) {
    throw error
  }
}

export default execute
