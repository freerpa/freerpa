/**
 * @file: AI 内核 - Agent 适配层（seam）
 * 主进程 LangGraph 负责 turn 内的 step 循环；这里只封装 IPC 生命周期：
 * 流式 part / 事件 / 渲染层 host 调用 / 结束 / 取消。
 */
const abortError = () => {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

export const createAgentAdapter = ({ createAgentRun }) => {
  let active = null

  return {
    /**
     * @param {Object} request
     * @param {AbortSignal|undefined} signal
     * @param {{onPart?:Function, onEvent?:Function, onHostCall?:Function}} handlers
     * @returns {Promise<{aborted?:boolean, outcome?:Object}>}
     */
    runTurn(request, signal, handlers = {}) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError())
        const handle = createAgentRun(request, {
          onPart: handlers.onPart,
          onEvent: handlers.onEvent,
          onHostCall: handlers.onHostCall,
          onDone: (result) => {
            active = null
            resolve(result || {})
          },
          onError: (error) => {
            active = null
            if (signal?.aborted) reject(abortError())
            else reject(error)
          }
        })
        active = handle
        signal?.addEventListener(
          'abort',
          () => {
            handle.abort()
          },
          { once: true }
        )
        handle.start()
      })
    },

    abort() {
      active?.abort()
    }
  }
}
