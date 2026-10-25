/**
 * @file: AI 内核 - LLM 适配层（seam）
 * 把主进程单步补全的 IPC chunk 协议归一为内核 chunk 词汇：
 * text-delta / reasoning-delta / tool-call / tool-call-delta / finish。
 * 主进程仍负责 provider 差异（reasoning 占位、strict schema、错误详情）。
 */
const mapPart = (part) => {
  if (!part) return null
  if (part.type === 'text') return { type: 'text-delta', text: part.text || '' }
  if (part.type === 'reasoning') return { type: 'reasoning-delta', text: part.text || '' }
  if (part.type === 'tool-call') {
    return {
      type: 'tool-call',
      callId: part.toolCallId,
      name: part.toolName,
      input: part.args ?? part.input ?? {}
    }
  }
  if (part.type === 'tool-arg') {
    return { type: 'tool-call-delta', callId: part.toolCallId, delta: part.arg || '' }
  }
  return null
}

const abortError = () => {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

export const createLlmAdapter = ({ createChatStream }) => ({
  /** 请求前准备（保留 dsh 的 prepareCall seam，当前无需改写请求） */
  prepareCall: (request) => request,

  /**
   * 流式调用
   * @param {{providerId:string, modelId:string, messages:Array, tools:Array, system:string}} request
   * @param {AbortSignal|undefined} signal
   * @param {(chunk:Object)=>void} onChunk
   * @returns {Promise<{text:string, reasoning:string, toolCalls:Array, finishReason:string, usage:Object, aborted?:boolean}>}
   */
  stream(request, signal, onChunk) {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn, value) => {
        if (settled) return
        settled = true
        fn(value)
      }
      const handle = createChatStream(
        {
          providerId: request.providerId,
          modelId: request.modelId,
          messages: request.messages,
          tools: request.tools,
          system: request.system
        },
        {
          onChunk: (part) => {
            const chunk = mapPart(part)
            if (chunk) onChunk?.(chunk)
          },
          onDone: (result) => {
            // 取消走 reject（与 agent 的 AbortError 分支对齐），否则中断会被当成正常完成
            if (result?.aborted) return finish(reject, abortError())
            finish(resolve, {
              text: result?.text || '',
              reasoning: result?.reasoning || '',
              toolCalls: result?.toolCalls || [],
              finishReason: result?.finishReason || '',
              usage: result?.usage || null
            })
          },
          onError: (error) => finish(reject, error)
        }
      )
      if (signal) {
        if (signal.aborted) {
          finish(reject, abortError())
          handle.abort?.()
          return
        }
        signal.addEventListener('abort', () => handle.abort?.(), { once: true })
      }
      handle.start()
    })
  }
})
