/**
 * @file: AI 内核 - 事件投影
 * 与 dsh 的 surface/deriveMessages 对齐：
 *  - deriveUiMessages：把 append-only 事件投影为对话 UI 消费的消息数组（user/assistant/tool）
 *  - deriveModelMessages：把事件投影为模型请求消息（user/assistant/tool），并应用删除墓碑
 * 事件是唯一事实来源；UI 字段（_usage/_ts/round_id 等）只在此处派生，不写回事件。
 */
import { AI_EVENT } from './events.js'

const asArray = (value) => (Array.isArray(value) ? value : [])

/** 收集删除墓碑：按 message_id 与 toolCallId 过滤，避免物理删除破坏日志可重放性 */
const collectTombstones = (events) => {
  const messageIds = new Set()
  const toolCallIds = new Set()
  for (const event of events) {
    if (event.type !== AI_EVENT.MESSAGE_DELETE) continue
    asArray(event.data?.messageIds).forEach((id) => id && messageIds.add(id))
    asArray(event.data?.toolCallIds).forEach((id) => id && toolCallIds.add(id))
  }
  return { messageIds, toolCallIds }
}

const turnIds = (events) => {
  const map = new Map()
  for (const event of events) {
    if (event.type === AI_EVENT.TURN_START) map.set(event.data?.turn, event.data?.turnId)
  }
  return map
}

// runtime-context（每步工作流快照）与 agent-inject（修复/守卫提示）只进模型历史，不展示为聊天气泡
const HIDDEN_USER_SOURCES = new Set(['runtime-context', 'agent-inject'])

const blocksToFields = (blocks) => {
  let text = ''
  let reasoning = ''
  const toolCalls = []
  for (const block of asArray(blocks)) {
    if (block?.type === 'text') text += block.text || ''
    else if (block?.type === 'reasoning') reasoning += block.text || ''
    else if (block?.type === 'tool-call') {
      toolCalls.push({
        id: block.callId,
        type: 'function',
        // arguments 保持对象：主进程 convertMessages 直接作为 AI SDK tool-call 的 input，
        // 传 JSON 字符串会触发 AI_InvalidPromptError
        function: { name: block.name, arguments: block.arguments ?? {} }
      })
    }
  }
  return { text, reasoning, toolCalls }
}

/**
 * UI 消息投影
 * @param {Array} events
 * @returns {Array} 按时间顺序的 user/assistant/tool 消息
 */
export const deriveUiMessages = (events = []) => {
  const tombstones = collectTombstones(events)
  const turns = turnIds(events)
  const out = []
  for (const event of events) {
    const turnId = turns.get(event.turn) || ''
    if (event.type === AI_EVENT.USER_MESSAGE) {
      const message = event.data?.message
      if (!message) continue
      if (HIDDEN_USER_SOURCES.has(event.data?.source || message.source)) continue
      if (tombstones.messageIds.has(message.message_id)) continue
      out.push({
        ...message,
        message_id: message.message_id,
        round_id: message.round_id || turnId,
        role: 'user',
        content: message.content || '',
        attachments: asArray(message.attachments),
        _ts: message._ts || event.ts
      })
      continue
    }
    if (event.type === AI_EVENT.ASSISTANT_MESSAGE) {
      const message = event.data?.message
      if (!message || tombstones.messageIds.has(message.message_id)) continue
      const { text, reasoning, toolCalls } = blocksToFields(message.content)
      const deletedToolCalls = toolCalls.filter((tc) => tombstones.toolCallIds.has(tc.id))
      if (!text && !reasoning && !toolCalls.length) continue
      out.push({
        message_id: message.message_id,
        round_id: message.round_id || turnId,
        role: 'assistant',
        content: text,
        reasoning_content: reasoning,
        tool_calls: toolCalls.filter((tc) => !tombstones.toolCallIds.has(tc.id)),
        attachments: [],
        _usage: event.data?.usage || null,
        _ts: event.ts,
        _interrupted: !!event.data?.interrupted,
        _failed: false,
        _deletedToolCalls: deletedToolCalls.length
      })
      continue
    }
    if (event.type === AI_EVENT.ASSISTANT_ATTEMPT) {
      const message = event.data?.message
      if (!message || tombstones.messageIds.has(message.message_id)) continue
      const { text, reasoning, toolCalls } = blocksToFields(message.content)
      const errorText = event.data?.error || ''
      if (!text && !reasoning && !errorText) continue
      out.push({
        message_id: message.message_id,
        round_id: message.round_id || turnId,
        role: 'assistant',
        content: errorText ? `${text}${text ? '\n\n' : ''}${errorText}` : text,
        reasoning_content: reasoning,
        tool_calls: toolCalls,
        attachments: [],
        _usage: null,
        _ts: event.ts,
        _interrupted: false,
        _failed: true
      })
      continue
    }
    if (event.type === AI_EVENT.TOOL_RESULT) {
      const message = event.data?.message
      if (!message) continue
      if (message.message_id && tombstones.messageIds.has(message.message_id)) continue
      if (tombstones.toolCallIds.has(message.tool_call_id)) continue
      out.push({
        message_id: message.message_id,
        round_id: message.round_id || turnId,
        role: 'tool',
        content: message.content || '',
        tool_call_id: message.tool_call_id,
        tool_name: message.tool_name || event.data?.name || '',
        duration_ms: event.data?.durationMs ?? message.duration_ms ?? null,
        attachments: [],
        _usage: null,
        _ts: event.ts,
        _ok: event.data?.ok !== false
      })
    }
  }
  return out
}

/**
 * 模型消息投影（等价 dsh deriveMessages）
 * - assistant/message 的 content blocks → content/reasoning_content/tool_calls
 * - tool/result → role:'tool' 配对消息
 * - runtime-context 的 user 消息照常进入模型历史（UI 不展示）
 */
export const deriveModelMessages = (events = []) => {
  const tombstones = collectTombstones(events)
  // 运行时快照只保留最新一条：每步都会刷新快照，历史快照既过时又白占上下文预算
  let latestRuntimeContextSeq = -1
  for (const event of events) {
    if (event.type === AI_EVENT.USER_MESSAGE && event.data?.source === 'runtime-context') {
      latestRuntimeContextSeq = event.seq
    }
  }
  const out = []
  for (const event of events) {
    if (event.type === AI_EVENT.USER_MESSAGE) {
      const message = event.data?.message
      if (!message || tombstones.messageIds.has(message.message_id)) continue
      if (event.data?.source === 'runtime-context' && event.seq !== latestRuntimeContextSeq) continue
      out.push({
        message_id: message.message_id,
        role: 'user',
        content: message.content || '',
        attachments: asArray(message.attachments),
        source: event.data?.source || message.source || '',
        round_id: message.round_id || ''
      })
      continue
    }
    if (event.type === AI_EVENT.ASSISTANT_MESSAGE) {
      const message = event.data?.message
      if (!message || tombstones.messageIds.has(message.message_id)) continue
      const { text, reasoning, toolCalls } = blocksToFields(message.content)
      if (tombstones.toolCallIds.size > 0) {
        for (let i = toolCalls.length - 1; i >= 0; i -= 1) {
          if (tombstones.toolCallIds.has(toolCalls[i].id)) toolCalls.splice(i, 1)
        }
      }
      if (!text && !reasoning && !toolCalls.length) continue
      out.push({
        message_id: message.message_id,
        role: 'assistant',
        content: text,
        reasoning_content: reasoning,
        tool_calls: toolCalls,
        round_id: message.round_id || ''
      })
      continue
    }
    if (event.type === AI_EVENT.TOOL_RESULT) {
      const message = event.data?.message
      if (!message) continue
      if (tombstones.toolCallIds.has(message.tool_call_id)) continue
      out.push({
        message_id: message.message_id,
        role: 'tool',
        content: message.content || '',
        tool_call_id: message.tool_call_id,
        tool_name: message.tool_name || ''
      })
    }
  }
  return out
}
