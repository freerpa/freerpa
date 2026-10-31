/**
 * @file: 消息配对修复纯函数（无 electron 依赖，可单测）
 * 参照 Reasonix NormalizeMessages 设计（internal/provider/provider.go）：
 * - 半流式坏 JSON 参数闭合（closeTruncatedJSON：括号栈平衡、补未终止字符串、去尾部逗号、冒号补 null）
 * - 空 toolName 回填（按 id 从 tool 结果取）
 * - 孤儿 tool 结果丢弃（无匹配 assistant tool_call）
 * - 乱序结果按 assistant.tool_calls 顺序重排
 * - 中断未完成调用补占位结果（防止缺配对导致 provider 400）
 * 输入/输出均为 renderer 内部消息格式（user / assistant / tool）。
 */

/** 闭合半流式截断的 JSON；无法修复返回 null */
export const closeTruncatedJSON = (raw) => {
  if (typeof raw !== 'string') return raw
  let text = raw.trimEnd()
  if (text === '') return '{}'

  const stack = []
  let inString = false
  let escaped = false
  let lastTokenColon = false // 最后一个有效 token 是否为冒号（值缺失）
  let endIndex = 0

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      endIndex = i + 1
      continue
    }
    if (ch === '"') {
      inString = true
      lastTokenColon = false
      endIndex = i + 1
    } else if (ch === '{' || ch === '[') {
      stack.push(ch)
      lastTokenColon = false
      endIndex = i + 1
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0) stack.pop()
      lastTokenColon = false
      endIndex = i + 1
    } else if (ch === ':') {
      lastTokenColon = true
      endIndex = i + 1
    } else if (ch === ',') {
      // 逗号不更新截断终点（尾部逗号会被自然截掉），但更新状态
      lastTokenColon = false
    } else if (!/\s/.test(ch)) {
      lastTokenColon = false
      endIndex = i + 1
    }
  }
  text = text.slice(0, endIndex)
  // 值缺失（冒号后无值）→ 补 null
  if (lastTokenColon) text += 'null'
  // 未闭合字符串 → 补引号
  if (inString) text += '"'
  // 补闭合括号
  for (let s = stack.length - 1; s >= 0; s--) {
    text += stack[s] === '{' ? '}' : ']'
  }
  try {
    JSON.parse(text)
    return text
  } catch {
    return null
  }
}

/** 归一化 tool_call 的 arguments（字符串→对象；坏 JSON 修复后 parse，仍失败降级 {}） */
const normalizeToolCallArguments = (raw) => {
  if (raw === undefined || raw === null) return {}
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') return {}
    try {
      return JSON.parse(trimmed)
    } catch {
      const fixed = closeTruncatedJSON(trimmed)
      if (fixed != null) {
        try {
          return JSON.parse(fixed)
        } catch {
          return {}
        }
      }
      return {}
    }
  }
  return {}
}

/**
 * 修复消息配对（wire 前最后一道防线）
 * @param {Array} messages renderer 内部格式消息
 * @param {Object} [opts]
 * @param {boolean} [opts.dropOrphanTools=true] 丢弃无匹配 assistant 的孤儿 tool 结果
 * @returns {Array} 修复后的消息（浅拷贝，不修改入参）
 */
export const normalizeMessages = (messages, { dropOrphanTools = true } = {}) => {
  if (!Array.isArray(messages)) return []
  const msgs = messages.map((m) => ({ ...m }))

  // 1. 归一化 assistant.tool_calls（过滤缺 id/function 的残缺项；arguments 对象化；name 可空待回填）
  msgs.forEach((m) => {
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
      m.tool_calls = m.tool_calls
        .filter((tc) => tc && tc.id && tc.function)
        .map((tc) => ({
          ...tc,
          function: { ...tc.function, arguments: normalizeToolCallArguments(tc.function.arguments) }
        }))
    }
  })

  // 2. 收集有效 call id；空 name 从 tool 结果回填
  const callsById = new Map()
  msgs.forEach((m) => {
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
      m.tool_calls.forEach((tc) => {
        if (!callsById.has(tc.id)) callsById.set(tc.id, tc)
      })
    }
  })
  msgs.forEach((m) => {
    if (m.role === 'tool' && m.tool_name && m.tool_call_id) {
      const call = callsById.get(m.tool_call_id)
      if (call && !call.function.name) call.function.name = m.tool_name
    }
  })
  // 回填后仍无 name 的残缺调用丢弃
  msgs.forEach((m) => {
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
      m.tool_calls = m.tool_calls.filter((tc) => tc.function.name)
    }
  })

  // 3. 配对校验：丢弃孤儿 tool；assistant 缺结果补占位
  const paired = []
  msgs.forEach((m, i) => {
    if (m.role === 'tool') {
      const call = m.tool_call_id ? callsById.get(m.tool_call_id) : undefined
      if (!call) {
        if (!dropOrphanTools) paired.push(m)
        return
      }
      paired.push({ ...m, tool_name: m.tool_name || call.function.name })
      return
    }
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      const laterToolIds = new Set(
        msgs.slice(i + 1).filter((x) => x.role === 'tool' && x.tool_call_id).map((x) => x.tool_call_id)
      )
      const missing = m.tool_calls.filter((tc) => !laterToolIds.has(tc.id))
      paired.push(m)
      // 中断未完成的调用补占位结果（固定文本，防 provider 400「tool 结果缺失」）
      missing.forEach((tc) => {
        paired.push({
          message_id: `interrupted-${tc.id}`,
          role: 'tool',
          tool_call_id: tc.id,
          tool_name: tc.function.name,
          content: '[no result: 该工具调用在上一轮被中断，无执行结果]'
        })
      })
      return
    }
    paired.push(m)
  })

  // 4. 乱序结果重排：每个 assistant 块后紧随的 tool 结果按 call 顺序重排（id 匹配，未知 id 尾部原序）
  const ordered = []
  let i = 0
  while (i < paired.length) {
    const m = paired[i]
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      ordered.push(m)
      i++
      const toolResults = []
      while (i < paired.length && paired[i].role === 'tool') {
        toolResults.push(paired[i])
        i++
      }
      const callOrder = m.tool_calls.map((tc) => tc.id)
      const byId = new Map()
      const unpaired = []
      toolResults.forEach((t) => {
        if (t.tool_call_id && callOrder.includes(t.tool_call_id)) byId.set(t.tool_call_id, t)
        else unpaired.push(t)
      })
      callOrder.forEach((id) => {
        if (byId.has(id)) ordered.push(byId.get(id))
      })
      unpaired.forEach((t) => ordered.push(t))
      continue
    }
    ordered.push(m)
    i++
  }
  return ordered
}
