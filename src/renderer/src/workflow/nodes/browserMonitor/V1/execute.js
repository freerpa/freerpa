/**
 * @file: 浏览器节点执行器
 */
import { page_eval } from '@pageEval'
const execute = async (node, context) => {

  const { onNodeEvent, sendNodeEvent, onBeforeDestroy, next } = context
  const { frameRate, quality } = node.config
  const { page } = node.inputs
  
  const cdp = await page.createCDPSession();
  onNodeEvent(async ({ type, data }) => {
    if (type === 'start') {
      console.error('start', frameRate, quality)
      // 🌟 核心替换：开启CDP原生屏幕推流（替代单次截图，无阻塞）
      await cdp.send('Page.startScreencast', {
        format: 'webp', // 推流编码：webp（体积最小，推荐），可选jpeg
        quality,    // 画质：0-100，80兼顾清晰和体积
        frameRate,  // 推流帧率：30帧/秒（流畅不卡顿，60帧可改60，视性能调整）
      });
      // 🌟 监听浏览器推流的帧数据（异步触发，非阻塞）
      cdp.on('Page.screencastFrame', async (frameData) => {
        try {
          sendNodeEvent({
            type: 'image',
            data: frameData.data
          })
          // 2. 必须向浏览器发送确认：已接收帧（否则浏览器会停止推流）
          await cdp.send('Page.screencastFrameAck', { sessionId: frameData.sessionId });
        } catch (err) {
          if (!err.message.includes('Target closed')) console.warn('推流转发错误：', err.message);
        }
      });
      // 获取浏览器视口尺寸（用于后续计算鼠标位置）
      const viewport = await page_eval(page, `(el) => {
            return {
              width: window.innerWidth,
              height: window.innerHeight
            }
          };`)
      // 🌟 初始化：发送浏览器视口尺寸（用于后续计算鼠标位置）
      sendNodeEvent({
        type: 'init',
        data: {
          viewport
        }
      });
    } else if (type === 'end') {
      console.error('end')
      // 停止推流
      await cdp.send('Page.stopScreencast');
    } else if (type === 'mouseMove') {
      await page.mouse.move(data.x, data.y);
    } else if (type === 'mouseDown') {
      await page.mouse.down({ button: data.button });
    } else if (type === 'mouseUp') {
      await page.mouse.up({ button: data.button });
    } else if (type === 'mouseWheel') {
      await page.mouse.wheel({
        deltaX: data.deltaX,
        deltaY: data.deltaY
      });
    } else if (type === 'input') {
      await page.keyboard.type(data);
    } else if (type === 'goto') {
      await page.goto(data);
    } else if (type === 'refresh') {
      await page.reload();
    } else if (type === 'forward') {
      await page.goForward();
    } else if (type === 'backward') {
      await page.goBack();
    }

  })
  // 发送状态信息
  sendNodeEvent({
    type: 'status',
    data: true
  })
  next()
  onBeforeDestroy(() => {
    sendNodeEvent({
      type: 'status',
      data: false
    })
  })

}

export default execute
