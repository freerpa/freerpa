/**
 * @file: 浏览器节点执行器
 */
import { page_eval } from '@pageEval'
const execute = async (node, context) => {

  const { onNodeEvent, sendNodeEvent, onBeforeDestroy, next } = context
  const { page } = node.inputs
  // 参数 clamp：避免 NaN / 越界导致 CDP 推流参数非法
  const frameRate = Math.max(1, Math.min(60, Number(node.config.frameRate) || 30))
  const quality = Math.max(1, Math.min(100, Number(node.config.quality) || 70))
  let cdp = null
  let streaming = false
  const frameHandler = async (frameData) => {
    try {
      sendNodeEvent({ type: 'image', data: frameData.data })
      // 必须回 ACK，否则浏览器停止推流
      await cdp.send('Page.screencastFrameAck', { sessionId: frameData.sessionId })
    } catch (err) {
      if (!err.message.includes('Target closed')) console.warn('推流转发错误：', err.message)
    }
  }

  cdp = await page.createCDPSession()
  cdp.on('Page.screencastFrame', frameHandler)

  onNodeEvent(async ({ type, data }) => {
    if (type === 'start') {
      if (streaming) return // 幂等：已在推流则跳过，避免重复 start/重复注册
      streaming = true
      // 开启 CDP 原生屏幕推流（替代单次截图，无阻塞）
      await cdp.send('Page.startScreencast', {
        format: 'webp', // 推流编码：webp（体积最小，推荐），可选 jpeg
        quality,        // 画质：0-100
        frameRate       // 推流帧率
      })
      // 获取浏览器视口尺寸（用于计算鼠标相对坐标）
      const viewport = await page_eval(page, `() => ({
            width: window.innerWidth,
            height: window.innerHeight
          })`)
      sendNodeEvent({ type: 'init', data: { viewport } })
    } else if (type === 'end') {
      await stopStream()
    } else if (type === 'mouseMove') {
      await page.mouse.move(data.x, data.y)
    } else if (type === 'mouseDown') {
      // 携带坐标定位，否则点击可能落在错误位置
      await page.mouse.down({ x: data.x, y: data.y, button: data.button })
    } else if (type === 'mouseUp') {
      await page.mouse.up({ x: data.x, y: data.y, button: data.button })
    } else if (type === 'mouseWheel') {
      await page.mouse.wheel({ x: data.x, y: data.y, deltaX: data.deltaX, deltaY: data.deltaY })
    } else if (type === 'input') {
      await page.keyboard.type(data)
    } else if (type === 'goto') {
      await page.goto(data)
    } else if (type === 'refresh') {
      await page.reload()
    } else if (type === 'forward') {
      await page.goForward()
    } else if (type === 'backward') {
      await page.goBack()
    }
  })

  const stopStream = async () => {
    if (!streaming) return
    streaming = false
    try {
      if (cdp && cdp.connection) await cdp.send('Page.stopScreencast')
    } catch (err) {
      if (!err.message.includes('Target closed')) console.warn('停止推流失败：', err.message)
    }
  }

  // 发送状态信息
  sendNodeEvent({ type: 'status', data: true })
  next()

  onBeforeDestroy(async () => {
    sendNodeEvent({ type: 'status', data: false })
    // 兜底：无论流程如何结束都停止推流并释放 CDP 会话，避免泄漏
    await stopStream()
    cdp.off('Page.screencastFrame', frameHandler)
    try { await cdp.detach() } catch (err) {
      if (!err.message.includes('Target closed')) console.warn('释放 CDP 会话失败：', err.message)
    }
  })
}

export default execute