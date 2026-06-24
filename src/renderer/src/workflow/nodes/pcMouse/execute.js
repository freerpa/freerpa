/**
 * @file: 剪切板操作节点执行器
 * @author: AutoMan
 * @date: 2025-07-30
 */
import robot from '@jitsi/robotjs'

const execute = async (node, context) => {
  const { config } = node
  const { complete, wait } = context

  try {
    const { type, position, customButton, customAction, customClickCount, customClickDelay, wheelDirection, wheelDelta } = config
    // 移动鼠标
    const { x, y } = position
    robot.moveMouseSmooth(x, y, .5)
    if (type === 'click') {
      // 点击鼠标
      robot.mouseClick('left')
      complete()
    } else if (type === 'move') {
      complete()
    } else if (type === 'wheel') {
      // 滚动鼠标滚轮
      const delta = wheelDirection === 'up' ? wheelDelta : -wheelDelta
      robot.scrollMouse(0, delta)
      complete()
    } else if (type === 'rightClick') {
      // 右击鼠标
      robot.mouseClick('right')
      complete()
    } else if (type === 'doubleClick') {
      // 双击鼠标
      robot.mouseClick('left', true)
      complete()
    } else if (type === 'custom') {
      console.log('自定义鼠标操作', customAction, customButton, customClickCount, customClickDelay)
      // 自定义鼠标操作
      if (customAction === 'click') {
        for (let i = 0; i < customClickCount; i++) {
          robot.mouseClick(customButton)
          await wait(customClickDelay)
        }
      } else {
        robot.mouseToggle(customAction, customButton)
      }
      complete()
    } else {
      throw new Error('无效的操作类型')
    }
  } catch (error) {
    throw new Error('鼠标操作节点执行错误', error)
  }
}

export default execute
