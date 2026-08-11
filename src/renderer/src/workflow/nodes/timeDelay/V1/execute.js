/**
 * @file: 延时节点执行器
 */

const execute = async (node, context) => {
  const { config } = node
  const { complete, sendNodeEvent, wait } = context
  const { mode = 'fixed', duration = 1000, minDuration = 1000, maxDuration = 1000 } = config
  let finalDuration = duration
  if (mode === 'random') {
    const randomDuration = Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration
    finalDuration = randomDuration
  }
  // 发送输出事件到渲染进程
  sendNodeEvent({
    type: 'duration',
    data: finalDuration
  })
  await wait(finalDuration)
  // 发送结果
  complete()
}

export default execute
