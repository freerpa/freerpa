/**
 * @file: 对话流 turn 渲染模型（对齐 Reasonix 的 partitionTurnItems 思路，纯函数可单测）
 * 输入：displayMessages（user/assistant，无 tool）+ toolMessages（role=tool 结果数组，含 tool_call_id）
 * 输出：轮次分组 —— 每组 = 用户消息 + 通道分段（过程段 process / 答案段 answer）
 *   - 过程段：含工具调用或仅推理的 assistant 内容（聚合为可折叠的「处理过程」区）
 *   - 答案段：含最终文本的 assistant 内容（平铺在折叠区外）
 *   - 工具结果（role=tool 持久化消息）按 tool_call_id 合并进对应卡片数据
 */

/** 解析工具结果 content（useAiChat 统一存 JSON 字符串 {ok, data/error}；旧数据/纯文本 fallback ok） */
export const parseToolOutput = (content) => {
  if (typeof content !== 'string' || !content) return { ok: true, text: '' }
  const trimmed = content.trim()
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed)
      if (obj && typeof obj === 'object' && 'ok' in obj) {
        // data 缺失（{ok:true} 无数据）→ 空文本，避免显示 '""'
        const dataText =
          obj.data === undefined || obj.data === null
            ? ''
            : typeof obj.data === 'string'
              ? obj.data
              : JSON.stringify(obj.data)
        return {
          ok: !!obj.ok,
          error: obj.error || '',
          text: obj.error || dataText
        }
      }
    } catch {
      /* 非 JSON 结构，走纯文本 */
    }
  }
  return { ok: true, text: trimmed }
}

/** created_at / _ts → 时间戳（历史消息 created_at 为 sqlite 本地时间字符串；内存消息 _ts 为 Date.now()） */
export const toTs = (m) => {
  if (m?._ts) return m._ts
  if (m?.created_at) {
    const t = new Date(String(m.created_at).replace(' ', 'T'))
    return isNaN(t.getTime()) ? null : t.getTime()
  }
  return null
}

/** 耗时格式化：< 1s 显示毫秒，否则秒 */
export const fmtDuration = (ms) => {
  if (ms == null || isNaN(ms)) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * 构建轮次分组
 * @param {Array} displayMessages user/assistant 消息（按 id 顺序）
 * @param {Array} toolMessages role=tool 结果消息（含 tool_call_id）
 * @returns {Array<{key, user, segments, durationMs, toolCount}>}
 */
export const buildRoundGroups = (displayMessages = [], toolMessages = []) => {
  // 工具结果索引：tool_call_id → { content, ok, error, text, durationMs }
  const toolByCallId = new Map()
  toolMessages.forEach((t) => {
    if (!t?.tool_call_id) return
    toolByCallId.set(t.tool_call_id, {
      ...parseToolOutput(t.content),
      durationMs: t.duration_ms || null
    })
  })

  // 1. 按 round_id 分组（旧数据无 round_id 时按 user 消息边界启发式）
  const groups = []
  let current = null
  for (const m of displayMessages) {
    if (m.role === 'user' || (m.round_id && (!current || m.round_id !== current.key))) {
      current = { key: m.round_id || m.message_id, user: null, items: [] }
      groups.push(current)
    }
    if (m.role === 'user') current.user = m
    else current.items.push(m)
  }

  // 2. 通道分区：过程段 / 答案段（答案后又有过程内容 → 新开过程段）
  return groups.map((group) => {
    const segments = []
    let seg = null
    const pushSegment = (type) => {
      if (!seg || seg.type !== type) {
        seg = { type, items: [], toolCards: [] }
        segments.push(seg)
      }
    }
    group.items.forEach((m) => {
      const hasText = !!(m.content && m.content.trim())
      const hasTools = Array.isArray(m.tool_calls) && m.tool_calls.length > 0
      const isProcess = hasTools || (!hasText && !!m.reasoning_content)
      if (isProcess) {
        pushSegment('process')
        seg.items.push(m)
        // 工具调用合并结果（消息级 _toolCards 供 Bubble 渲染；段级 toolCards 供统计）
        const cards = (m.tool_calls || [])
          .map((tc) => {
            if (!tc?.id) return null
            const output = toolByCallId.get(tc.id) || { ok: true, text: '' }
            return {
              id: tc.id,
              name: tc.function?.name || '',
              arguments: tc.function?.arguments,
              // 流式参数增量（useAiChat upsertToolArg 拼接，onDone 完整 arguments 覆盖后为空）
              _argsDelta: tc._argsDelta || '',
              ...output
            }
          })
          .filter(Boolean)
        m._toolCards = cards
        seg.toolCards.push(...cards)
      } else if (hasText) {
        pushSegment('answer')
        seg.items.push(m)
      }
      // 空内容 assistant（异常中间态）忽略
    })

    // 3. 段头与组级统计（组耗时从用户消息发出算起，含 group.user 的 _ts）
    const allTs = [...(group.user ? [toTs(group.user)] : []), ...group.items.map(toTs)].filter((t) => t != null)
    const groupDuration = allTs.length > 1 ? Math.max(...allTs) - Math.min(...allTs) : null
    const toolCount = segments.reduce((n, s) => n + (s.toolCards?.length || 0), 0)
    segments.forEach((s) => {
      const ts = s.items.map(toTs).filter((t) => t != null)
      s.durationMs = ts.length > 1 ? Math.max(...ts) - Math.min(...ts) : null
    })
    return { ...group, segments, durationMs: groupDuration, toolCount }
  })
}
