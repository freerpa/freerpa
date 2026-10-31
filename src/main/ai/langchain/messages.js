/**
 * @file: renderer 内部消息 / OpenAI 风格工具定义 → LangChain 消息与工具
 */
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { normalizeMessages } from '../messageNormalizer.js'

const ATTACHMENT_LABELS = {
  file: '文件',
  workflow: '工作流',
  browser: '浏览器',
  table: '数据表',
  element: '元素集'
}

/** 用户消息附件引用拼进文本，让模型感知用户引用的资源 */
const userText = (message) => {
  let text = message.content || ''
  const attachments = message.attachments
  if (Array.isArray(attachments) && attachments.length > 0) {
    const lines = attachments
      .map((a) => `- ${ATTACHMENT_LABELS[a.type] || a.type}「${a.name}」${a.id ? `(ID: ${a.id})` : ''}`)
      .join('\n')
    text = `${text}\n\n【用户引用的资源】\n${lines}`
  }
  return text
}

/**
 * @param {Array} messages renderer 内部格式消息（user/assistant/tool）
 * @param {{thinking?:boolean}} [options]
 */
export const toLangChainMessages = (messages = [], { thinking = false } = {}) => {
  // wire 前最后一道：修复消息配对（孤儿 tool / 乱序 / 坏 JSON 参数 / 中断占位）
  return normalizeMessages(messages).map((message) => {
    if (message.role === 'tool') {
      return new ToolMessage({
        content: String(message.content ?? ''),
        tool_call_id: message.tool_call_id,
        name: message.tool_name || ''
      })
    }
    if (message.role === 'assistant') {
      const toolCalls = (message.tool_calls || [])
        .filter((tc) => tc?.id && tc?.function?.name)
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          args: tc.function.arguments || {},
          type: 'tool_call'
        }))
      const additional_kwargs = {}
      if (message.reasoning_content) {
        additional_kwargs.reasoning_content = message.reasoning_content
      } else if (thinking && toolCalls.length > 0) {
        // DeepSeek 适配：assistant 带 tool_calls 的回合必须含 reasoning_content 键，否则 400
        additional_kwargs.reasoning_content = ' '
      }
      return new AIMessage({
        content: message.content || '',
        tool_calls: toolCalls,
        additional_kwargs
      })
    }
    return new HumanMessage(userText(message))
  })
}

/** 递归剥离 JSON Schema 的 default 字段（部分供应商不支持 default，会导致 400） */
const stripDefault = (schema) => {
  if (!schema || typeof schema !== 'object') return schema
  const rest = { ...schema }
  delete rest.default
  if (rest.properties) {
    Object.keys(rest.properties).forEach((key) => {
      rest.properties[key] = stripDefault(rest.properties[key])
    })
  }
  if (rest.items) rest.items = stripDefault(rest.items)
  return rest
}

/**
 * OpenAI 风格 tools → LangChain 可绑定的工具定义（原始 function schema 直接透传，
 * OpenAI/Anthropic/Gemini 适配层都会识别该结构，避免引入 zod 依赖）。
 */
export const toLangChainTools = (tools = []) =>
  tools
    .map((tool) => {
      const fn = tool?.function
      if (!fn?.name) return null
      return {
        type: 'function',
        function: {
          name: fn.name,
          description: fn.description || '',
          parameters: stripDefault(fn.parameters || { type: 'object', properties: {} })
        }
      }
    })
    .filter(Boolean)

export const buildSystemMessage = (system) => new SystemMessage(system || '')
