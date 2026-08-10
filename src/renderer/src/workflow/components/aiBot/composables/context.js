/**
 * @file: AI 会话上下文的纯函数加工层（无状态、可单测）
 * - snipContext：上下文预算（超限先截断超长 tool 结果，仍超则丢弃最早的 tool 结果）
 * - sanitizeContext：清洗提交给模型的上下文，自愈残缺工具调用配对
 * - friendlyAIError：AI 调用错误 → 用户可读提示
 * - toOpenAiToolCall：流式 part → OpenAI 风格 tool_call
 */
import { MAX_OUTPUT } from '../tools/guard'

const BUDGET_CHARS = 240000 // 提交上下文总字符预算
const MAX_TOOL_RESULT = MAX_OUTPUT // 单条 tool 结果截断上限（与工具输出护栏同一值）

/**
 * 上下文预算：总长超限时先截断超长 tool 结果（head），仍超则丢弃最早的 tool 结果（不丢 sqlite 原文）。
 * 增量维护 total 长度，避免每次截断/丢弃后全量重算。
 */
export const snipContext = (ctx) => {
  const estimate = (m) => JSON.stringify(m).length
  const sizes = ctx.map((m) => estimate(m))
  let total = sizes.reduce((sum, n) => sum + n, 0)
  if (total <= BUDGET_CHARS) return ctx
  let result = ctx.map((m, i) => {
    if (m.role !== 'tool') return m
    const text = String(m.content || '')
    if (text.length <= MAX_TOOL_RESULT) return m
    const cut = { ...m, content: `${text.slice(0, MAX_TOOL_RESULT)}…[truncated]` }
    total = total - sizes[i] + estimate(cut)
    sizes[i] = estimate(cut)
    return cut
  })
  while (total > BUDGET_CHARS) {
    const idx = result.findIndex((m) => m.role === 'tool')
    if (idx === -1) break
    total -= sizes[idx]
    result = [...result.slice(0, idx), ...result.slice(idx + 1)]
    sizes.splice(idx, 1)
  }
  return result
}

/**
 * 清洗提交给模型的上下文，自愈残缺工具调用配对：
 * - assistant 的 tool_calls 若 id/function.name 缺失或其后无对应 tool 结果 → 剔除该调用
 *   （AI SDK 校验这些字段，undefined 会抛 AI_InvalidPromptError 拒绝发送请求，
 *   导致"一旦失败永远失败"）
 * - tool 消息若无有效对应 assistant tool_call → 剔除孤儿结果
 */
export const sanitizeContext = (ctx) => {
  // 有效 tool_call：id 与 function.name 均非空才计入
  const validIds = new Set()
  ctx.forEach((m) => {
    if (m.role === 'assistant') {
      ;(m.tool_calls || []).forEach((tc) => {
        if (tc?.id && tc.function?.name) validIds.add(tc.id)
      })
    }
  })
  const cleaned = ctx.map((m, i) => {
    if (m.role === 'tool') {
      return m.tool_call_id && validIds.has(m.tool_call_id) ? m : null
    }
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const laterToolIds = new Set(
        ctx.slice(i + 1).filter((x) => x.role === 'tool' && x.tool_call_id).map((x) => x.tool_call_id)
      )
      const kept = m.tool_calls.filter((tc) => tc?.id && tc.function?.name && laterToolIds.has(tc.id))
      if (kept.length !== m.tool_calls.length) return { ...m, tool_calls: kept }
    }
    return m
  })
  return cleaned.filter(Boolean)
}

/** 把 AI 调用错误转成用户可读的提示（区分认证/网络/模型等常见原因） */
export const friendlyAIError = (error) => {
  const msg = String(error?.message || error || '')
  if (!msg || msg === 'Error') return '调用失败：模型响应异常，请重试'
  if (/401|403|unauthori|invalid api|apikey|api key|authentication|permission/i.test(msg)) {
    return '调用失败：API KEY 无效或已过期，请在「设置 → 模型管理」中检查供应商配置'
  }
  if (/404/.test(msg) && /model|not found/i.test(msg)) {
    return '调用失败：模型不存在，请在「设置 → 模型管理」中确认模型 ID'
  }
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|network error|socket/i.test(msg)) {
    return '调用失败：无法连接 AI 供应商，请检查网络与 API 地址'
  }
  if (/429|rate limit|too many requests/i.test(msg)) {
    return '调用失败：请求过于频繁（限流），请稍后重试'
  }
  if (/400|422|schema|validation|invalid/i.test(msg)) {
    return `调用失败：请求参数异常（${msg.slice(0, 120)}）`
  }
  return `调用失败：${msg.slice(0, 200)}`
}

/** 流式 tool-call part → OpenAI 风格 tool_call（{ id, type, function: { name, arguments } }） */
export const toOpenAiToolCall = (tc) => ({
  id: tc.toolCallId,
  type: 'function',
  function: { name: tc.toolName, arguments: tc.args || {} }
})
