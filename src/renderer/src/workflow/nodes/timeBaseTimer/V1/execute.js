/**
 * @file: 计数器节点执行器
 */

const execute = async (node, context) => {
  const { store, config } = node
  const { complete, setOutputs, sendNodeEvent, onBeforeDestroy } = context
  const { timerSecond } = config
  
  if (!store.second) {
    store.second = 0
  }
  store.timer = null
  const timer = {
    clear: function () {
      store.second = 0
      setOutputs({
        second: store.second,
        remainingSecond: timerSecond
      })
      sendNodeEvent({
        type: 'clear',
        data: store.second
      })
    },
    start: function () {
      // 重复 start 前先清除旧 interval，避免计时加速/泄漏
      if (store.timer) {
        clearInterval(store.timer)
      }
      store.timer = setInterval(() => {
        store.second++
        const remainingSecond = timerSecond - store.second
        setOutputs({
          second: store.second,
          remainingSecond: remainingSecond
        })
        if (remainingSecond <= 0) {
          complete()
          timer.stop()
        }
      }, 1000)
      sendNodeEvent({
        type: 'start',
        data: store.second
      })
    },
    stop: function () {
      clearInterval(store.timer)
      sendNodeEvent({
        type: 'stop',
        data: store.second
      })
    }
  }
  onBeforeDestroy(() => {
    timer.stop()
  })
  timer.start()
  setOutputs({
    timer: timer,
    second: store.second,
    remainingSecond: timerSecond
  })

}

export default execute
