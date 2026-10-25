/**
 * @file: AI 会话事件（shared）
 * 主进程与渲染进程共用的「旧消息 → append-only 事件」转换。
 * 仅供一次性迁移与主进程异常时的渲染端兜底使用，不承载运行时状态。
 */

/** 事件类型词汇（与 dsh 的 session event 对齐，按 FreeRPA 需要裁剪） */
export const AI_EVENT = {
  TURN_START: 'turn/start',
  STEP_START: 'step/start',
  SYSTEM_MESSAGE: 'system/message',
  USER_MESSAGE: 'user/message',
  ASSISTANT_MESSAGE: 'assistant/message',
  ASSISTANT_ATTEMPT: 'assistant/attempt',
  TOOL_CALL: 'tool/call',
  TOOL_RESULT: 'tool/result',
  STEP_END: 'step/end',
  TURN_END: 'turn/end',
  MESSAGE_DELETE: 'feedback/message-delete'
}

const parseJson = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

/** 旧 assistant.tool_calls（OpenAI 风格）→ 事件块 */
const toToolCallBlocks = (toolCalls = []) =>
  (Array.isArray(toolCalls) ? toolCalls : [])
    .filter((tc) => tc?.id && tc?.function?.name)
    .map((tc) => ({
      type: 'tool-call',
      callId: tc.id,
      name: tc.function.name,
      arguments: parseJson(tc.function.arguments, {}) || {}
    }))

/**
 * 把旧的 ai_chat_messages 行转换为事件序列。
 * - round_id → turn；无 round_id 时按 user 消息边界切 turn
 * - 每条 assistant = 一个 step；其 tool_calls 按 tool_call_id 匹配旧 tool 行补 tool/call + tool/result
 * @param {Array} messages 旧消息（按 id 升序）
 * @returns {Array<{type:string, turn:number, step:number|null, data:Object}>}
 */
export const legacyMessagesToEvents = (messages = []) => {
  const out = []
  const toolRows = new Map()
  for (const row of messages) {
    if (row?.role === 'tool' && row.tool_call_id) toolRows.set(row.tool_call_id, row)
  }
  let turn = 0
  let step = 0
  let turnOpen = false
  let turnId = ''
  let lastTs
  const rowTs = (row) => {
    if (!row?.created_at) return undefined
    const ts = Date.parse(String(row.created_at).replace(' ', 'T'))
    return Number.isNaN(ts) ? undefined : ts
  }
  // ts 必须保留原消息时间：迁移后 UI 的耗时/时间线依赖事件时间戳
  const push = (type, turnNo, stepNo, data, ts = lastTs) => {
    out.push({ type, turn: turnNo, step: stepNo, data, ...(ts ? { ts } : {}) })
  }
  const closeTurn = () => {
    if (!turnOpen) return
    push(AI_EVENT.TURN_END, turn, 0, { turn, reason: { kind: 'completed' } })
    turnOpen = false
  }
  for (const row of messages) {
    if (!row) continue
    const ts = rowTs(row)
    if (ts) lastTs = ts
    if (row.role === 'user') {
      closeTurn()
      turn += 1
      step = 0
      turnOpen = true
      turnId = row.round_id || `turn-${turn}-${row.message_id || 'legacy'}`
      push(AI_EVENT.TURN_START, turn, 0, { turn, turnId }, ts)
      push(AI_EVENT.USER_MESSAGE, turn, 0, {
        turn,
        step: 0,
        message: {
          message_id: row.message_id,
          round_id: turnId,
          role: 'user',
          content: row.content || '',
          attachments: parseJson(row.attachments, []),
          _ts: ts
        }
      }, ts)
      continue
    }
    if (row.role === 'assistant') {
      if (!turnOpen) {
        turn += 1
        turnOpen = true
        turnId = row.round_id || `turn-${turn}-assistant-${row.message_id || 'legacy'}`
        push(AI_EVENT.TURN_START, turn, 0, { turn, turnId }, ts)
      }
      step += 1
      push(AI_EVENT.STEP_START, turn, step, { turn, step }, ts)
      const blocks = []
      if (row.reasoning_content) blocks.push({ type: 'reasoning', text: row.reasoning_content })
      if (row.content) blocks.push({ type: 'text', text: row.content })
      blocks.push(...toToolCallBlocks(parseJson(row.tool_calls, [])))
      push(AI_EVENT.ASSISTANT_MESSAGE, turn, step, {
        turn,
        step,
        message: {
          message_id: row.message_id,
          round_id: turnId,
          role: 'assistant',
          content: blocks,
          created_at: row.created_at
        },
        usage: parseJson(row.usage, null)
      }, ts)
      for (const block of blocks) {
        if (block.type !== 'tool-call') continue
        push(AI_EVENT.TOOL_CALL, turn, step, {
          turn,
          step,
          callId: block.callId,
          name: block.name,
          arguments: block.arguments
        }, ts)
        const toolRow = toolRows.get(block.callId)
        if (toolRow) {
          push(AI_EVENT.TOOL_RESULT, turn, step, {
            turn,
            step,
            callId: block.callId,
            durationMs: toolRow.duration_ms ?? null,
            message: {
              message_id: toolRow.message_id,
              round_id: turnId,
              role: 'tool',
              tool_call_id: block.callId,
              tool_name: block.name,
              content: toolRow.content || ''
            }
          }, rowTs(toolRow) || ts)
        }
      }
      push(AI_EVENT.STEP_END, turn, step, { turn, step }, ts)
      continue
    }
    // system 或不认识的旧角色：忽略（系统提示不进入事件日志）
  }
  closeTurn()
  return out.map((e, index) => ({ ...e, id: `legacy:${index + 1}` }))
}
