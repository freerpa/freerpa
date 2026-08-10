/**
 * @file: AI 聊天引擎（AI SDK v7 streamText 单步补全）
 * 设计：主进程只做「单轮补全」——renderer 组装完整 messages 并发起，
 * 流式增量经 onChunk 回调逐片转发；工具调用不在此自动执行（execute 省略），
 * 返回 tool-calls 后由 renderer 执行并把结果作为 tool 消息追加发起下一轮。
 */
import { streamText, jsonSchema } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { normalizeMessages } from './messages-utils.js'

/** 供应商 + 模型ID → AI SDK language model */
export const buildModel = (provider, modelId) => {
  const { apiKey, baseURL } = provider
  let providerInstance
  switch (provider.protocol) {
    case 'anthropic':
      providerInstance = createAnthropic({ apiKey, baseURL: baseURL || undefined })
      break
    case 'google':
      providerInstance = createGoogleGenerativeAI({ apiKey, baseURL: baseURL || undefined })
      break
    case 'openai-compatible':
    default:
      providerInstance = createOpenAICompatible({
        name: provider.name,
        baseURL,
        apiKey,
        // 关闭 strict JSON Schema（AI SDK 默认 true）：OpenAI strict 模式要求「所有属性必填」，
        // 与 schema.js 生成的常规 JSON Schema 冲突，会导致 400 → 流中断（表现为"模型流式响应中断"）
        strictJsonSchema: false
      })
      break
  }
  // AI SDK v7 统一 ProviderV4.languageModel
  return providerInstance.languageModel(modelId)
}

/** renderer 消息 → AI SDK ModelMessage
 * @param {Array} messages
 * @param {Object} [opts]
 * @param {boolean} [opts.thinking=false] DeepSeek 等 thinking 模型：assistant 带 tool_calls 必须含 reasoning part（空文本也发），否则 400
 */
const convertMessages = (messages = [], { thinking = false } = {}) =>
  messages.map((msg) => {
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: msg.tool_call_id,
            // toolName 缺失兜底为空串（AI SDK 要求 string，undefined 校验失败）
            toolName: msg.tool_name || '',
            // AI SDK v7 要求 output 为 { type:'text', value } 对象；裸字符串会校验失败
            output: { type: 'text', value: String(msg.content ?? '') }
          }
        ]
      }
    }
    if (msg.role === 'assistant') {
      const parts = []
      const hasToolCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0
      if (msg.reasoning_content) {
        parts.push({ type: 'reasoning', text: msg.reasoning_content })
      } else if (thinking && hasToolCalls) {
        // DeepSeek 适配：assistant 带 tool_calls 的回合必须含 reasoning_content 键，否则 400。
        // 注意 openai-compatible provider 对空 reasoning part 会丢弃（reasoning.length>0 才发送该键），
        // 因此用空格占位确保键被发送
        parts.push({ type: 'reasoning', text: ' ' })
      }
      if (msg.content) parts.push({ type: 'text', text: msg.content })
      // 只保留字段完整的 tool_calls（id/function.name 缺失会导致 AI SDK 校验失败）
      ;(msg.tool_calls || []).forEach((tc) => {
        if (!tc?.id || !tc.function?.name) return
        parts.push({
          type: 'tool-call',
          toolCallId: tc.id,
          toolName: tc.function.name,
          input: tc.function?.arguments || {}
        })
      })
      return { role: 'assistant', content: parts }
    }
    if (msg.role === 'user') {
      // 附件引用（文件/工作流/浏览器/数据表/元素集）拼进文本，让模型感知用户引用的资源
      let text = msg.content || ''
      const attachments = msg.attachments
      if (Array.isArray(attachments) && attachments.length > 0) {
        const labelMap = { file: '文件', workflow: '工作流', browser: '浏览器', table: '数据表', element: '元素集' }
        const attachText = attachments
          .map((a) => `- ${labelMap[a.type] || a.type}「${a.name}」${a.id ? `(ID: ${a.id})` : ''}`)
          .join('\n')
        text = `${text}\n\n【用户引用的资源】\n${attachText}`
      }
      return { role: 'user', content: [{ type: 'text', text }] }
    }
  })

/** 递归剥离 JSON Schema 的 default 字段（OpenAI strict 工具模式不支持 default，会导致 400） */
const stripDefault = (schema) => {
  if (!schema || typeof schema !== 'object') return schema
  const rest = { ...schema }
  delete rest.default
  if (rest.properties) {
    Object.keys(rest.properties).forEach((k) => {
      rest.properties[k] = stripDefault(rest.properties[k])
    })
  }
  if (rest.items) rest.items = stripDefault(rest.items)
  return rest
}

/** OpenAI 风格 tools 数组 → AI SDK ToolSet（inputSchema 用 JSON Schema，renderer 无需引 zod） */
const convertTools = (tools = []) => {
  const result = {}
  for (const tool of tools) {
    const fn = tool?.function
    if (!fn?.name) continue
    result[fn.name] = {
      description: fn.description || '',
      inputSchema: jsonSchema(stripDefault(fn.parameters || { type: 'object', properties: {} }))
    }
  }
  return result
}

/** DeepSeek 等 thinking 模型判定（assistant 带 tool_calls 必须含 reasoning_content 键）；只按 modelId，且仅命中 reasoner 类（deepseek-chat 为非 thinking 不注入） */
const isThinkingModel = (provider, modelId) => /deepseek-reasoner|reasoner/i.test(`${modelId || ''}`)

/**
 * 单轮流式补全
 * @param {Object} opts
 * @param {Object} opts.provider 含明文 apiKey 的供应商
 * @param {string} opts.modelId 模型ID
 * @param {Array} opts.messages renderer 内部格式消息
 * @param {Array} opts.tools OpenAI 风格工具定义
 * @param {AbortSignal} [opts.signal]
 * @param {(part: Object) => void} opts.onChunk 流式增量回调
 * @returns {Promise<{text, reasoning, toolCalls, finishReason}>}
 */
export const streamChat = async ({ provider, modelId, messages, tools, system, signal, onChunk }) => {
  const result = streamText({
    model: buildModel(provider, modelId),
    system,
    // wire 前最后一道：修复消息配对（孤儿 tool / 乱序 / 坏 JSON 参数 / 中断占位）
    messages: convertMessages(normalizeMessages(messages), {
      thinking: isThinkingModel(provider, modelId)
    }),
    tools: convertTools(tools),
    abortSignal: signal,
    // AI SDK 内置重试（网络错误 / 408/429/5xx 指数退避；400/401/422 不重试；
    // SSE body 中断不重试，交由 renderer 工具循环处理）；显式加大重试次数 + 防挂死超时
    maxRetries: 3,
    // reasoner 类模型首 token 延迟可达数分钟，thinking 模型放宽超时
    timeout: isThinkingModel(provider, modelId) ? 300000 : 120000
  })

  // stream 迭代抛错（如工具结果缺失校验）时，result.text/toolCalls 等 promise 的 rejection
  // 会无人处理 → unhandledRejection；错误本身已由下方 catch/error part 路径转发，这里吞掉即可
  const swallow = (p) => p?.then?.(undefined, () => {})
  swallow(result.text)
  swallow(result.toolCalls)
  swallow(result.reasoningText)

  let finishReason = ''
  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        // 兼容不同 provider/版本 part 字段差异（v7 为 delta，部分实现为 text）
        onChunk?.({ type: 'text', text: part.delta ?? part.text ?? '' })
        break
      case 'reasoning-delta':
        onChunk?.({ type: 'reasoning', text: part.delta ?? part.text ?? '' })
        break
      case 'tool-input-available':
        onChunk?.({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.input
        })
        break
      case 'tool-input-delta':
        // 参数流式增量（部分 provider 只发 delta 不发完整 input）：透传给 renderer 实时拼接展示
        onChunk?.({ type: 'tool-arg', toolCallId: part.toolCallId, arg: part.inputTextDelta || '' })
        break
      case 'error':
        // errorText 可能为空（个别 provider 行为），兜底给出可读信息，避免错误 message 为空
        throw new Error(part.errorText || '模型流式响应中断')
      case 'finish':
        finishReason = part.finishReason || ''
        break
      default:
        break
    }
  }

  return {
    text: (await result.text) || '',
    reasoning: (await result.reasoningText) || '',
    // 归一化 toolCalls 形状与流式 part 一致：{ toolCallId, toolName, args }
    // （AI SDK v7 result.toolCalls 元素为 { type, toolCallId, toolName, input }）
    toolCalls: ((await result.toolCalls) || []).map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: tc.input ?? {}
    })),
    finishReason,
    // token 用量（AI SDK v7：{ inputTokens, outputTokens, totalTokens }），透传展示
    usage: await result.usage
  }
}
