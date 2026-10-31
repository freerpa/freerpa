/**
 * @file: LangChain 模型工厂
 * 按供应商协议创建 LangChain ChatModel：
 *  - openai-compatible → ChatOpenAI（自定义 baseURL，兼容 DeepSeek/Kimi/千问/Ollama 等）
 *  - anthropic → ChatAnthropic
 *  - google → ChatGoogleGenerativeAI
 * 每个 turn 创建一次实例、跨 step 复用，兼顾连接复用与并发隔离。
 */
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

const MAX_RETRIES = 3
const DEFAULT_TIMEOUT = 120000
const THINKING_TIMEOUT = 300000

/** DeepSeek 等 thinking 模型判定（assistant 带 tool_calls 必须含 reasoning_content 键） */
export const isThinkingModel = (modelId) => /deepseek-reasoner|reasoner/i.test(`${modelId || ''}`)

/** 把 assistant 历史里的 reasoning_content 回填到 OpenAI wire 消息（DeepSeek reasoner 工具轮必需） */
const injectReasoningContent = (wireMessages, lcMessages) => {
  if (!Array.isArray(wireMessages) || !Array.isArray(lcMessages)) return
  const length = Math.min(wireMessages.length, lcMessages.length)
  for (let i = 0; i < length; i += 1) {
    const wire = wireMessages[i]
    const message = lcMessages[i]
    if (wire?.role !== 'assistant') continue
    const reasoning = message?.additional_kwargs?.reasoning_content
    if (typeof reasoning === 'string' && reasoning) wire.reasoning_content = reasoning
  }
}

/**
 * ChatOpenAI 默认不会把 additional_kwargs.reasoning_content 发送到 wire；
 * DeepSeek 等供应商在多轮工具调用中要求该字段，这里在请求前补回。
 */
class ReasoningChatOpenAI extends ChatOpenAI {
  constructor(fields) {
    super(fields)
    // ChatOpenAI 是门面类，实际请求由内部 completions 实例发起，需在内部实例上补因子
    const completions = this.completions
    if (completions?.completionWithRetry) {
      const original = completions.completionWithRetry.bind(completions)
      completions.completionWithRetry = (request, requestOptions) => {
        const outgoing = this._lcOutgoingMessages
        if (outgoing && request?.messages) injectReasoningContent(request.messages, outgoing)
        return original(request, requestOptions)
      }
    }
  }

  async *_streamResponseChunks(messages, options, runManager) {
    // 同一实例在一个 turn 内按 step 串行调用，字段只在该请求生命周期内有效
    this._lcOutgoingMessages = messages
    try {
      yield* super._streamResponseChunks(messages, options, runManager)
    } finally {
      this._lcOutgoingMessages = undefined
    }
  }
}

/**
 * @param {{protocol?:string, baseURL?:string, apiKey?:string}} provider
 * @param {string} modelId
 * @returns {import('@langchain/core/language_models/chat_models').BaseChatModel}
 */
export const createChatModel = (provider, modelId) => {
  const thinking = isThinkingModel(modelId)
  const timeout = thinking ? THINKING_TIMEOUT : DEFAULT_TIMEOUT
  const apiKey = provider?.apiKey || undefined
  const baseURL = provider?.baseURL || undefined

  switch (provider?.protocol) {
    case 'anthropic':
      return new ChatAnthropic({
        model: modelId,
        apiKey,
        anthropicApiUrl: baseURL,
        maxRetries: MAX_RETRIES,
        streaming: true,
        streamUsage: true,
        clientOptions: { ...(baseURL ? { baseURL } : {}), timeout, maxRetries: MAX_RETRIES }
      })
    case 'google':
      return new ChatGoogleGenerativeAI({
        model: modelId,
        apiKey,
        baseUrl: baseURL,
        maxRetries: MAX_RETRIES,
        streaming: true
      })
    case 'openai-compatible':
    default:
      return new ReasoningChatOpenAI({
        model: modelId,
        apiKey,
        maxRetries: MAX_RETRIES,
        streaming: true,
        streamUsage: true,
        timeout,
        configuration: baseURL ? { baseURL } : {}
      })
  }
}
