/**
 * @file: AI 会话上下文的纯函数加工层（无状态、可单测）
 * - stripUiFields：提交前剥离 UI/内部字段（message_id/round_id/_usage 等），减小体积并避免 AI SDK 校验干扰
 * - snipContext：上下文预算（超限先截断超长 tool 结果，仍超则丢弃最早的 tool 结果；丢弃后由
 *   sanitizeContext 连带剔除无配对结果的 assistant tool_call，避免主进程补"中断占位"误导模型）
 * - sanitizeContext：清洗提交给模型的上下文，自愈残缺工具调用配对
 * - friendlyAIError：AI 调用错误 → 用户可读提示
 * - toOpenAiToolCall：流式 part → OpenAI 风格 tool_call
 */
import { MAX_OUTPUT } from '../tools/guard'

const DEFAULT_BUDGET_CHARS = 240000 // 默认提交上下文总字符预算（≈60k tokens，按 4 字符/token 粗估）
const MAX_TOOL_RESULT = MAX_OUTPUT // 单条 tool 结果截断上限（与工具输出护栏同一值）

/** 提交前剥离的 UI/内部字段；attachments 必须保留（主进程 convertMessages 用于拼接附件引用文本） */
const UI_ONLY_FIELDS = ['message_id', 'round_id', '_ts', '_usage', '_finishReason', 'loading', 'tool_calling', '_toolCards', '_argsDelta']

/** 提交给模型前剥离 UI/内部字段（返回新数组，不改入参） */
export const stripUiFields = (messages = []) =>
  messages.map((m) => {
    const copy = { ...m }
    UI_ONLY_FIELDS.forEach((k) => delete copy[k])
    if (Array.isArray(copy.tool_calls)) {
      copy.tool_calls = copy.tool_calls.map((tc) => {
        const t = { ...tc }
        delete t._argsDelta
        return t
      })
    }
    return copy
  })

/**
 * 按模型 ID 推断上下文预算（字符）：小窗口模型收紧留余量，大窗口放宽；
 * 无法识别的模型回退默认值。粗略按 4 字符/token 折算。
 */
export const budgetForModel = (model) => {
  const id = String(model?.modelId || '').toLowerCase()
  if (/deepseek/.test(id)) return 200000 // 64k 窗口（deepseek-chat/reasoner）
  if (/gpt-4|o1|claude|gemini|qwen|glm|moonshot/.test(id)) return 400000 // 128k+ 窗口
  return DEFAULT_BUDGET_CHARS
}

/**
 * 上下文预算：总长超限时先截断超长 tool 结果（head），仍超则丢弃最早的 tool 结果（不丢 sqlite 原文）。
 * 丢弃 tool 结果后，对应 assistant 的 tool_call 由随后的 sanitizeContext 连带剔除（无配对结果即移除），
 * 避免主进程 normalizeMessages 补"中断占位"误导模型。
 * 增量维护 total 长度，避免每次截断/丢弃后全量重算。
 */
export const snipContext = (ctx, budgetChars = DEFAULT_BUDGET_CHARS) => {
  const estimate = (m) => JSON.stringify(m).length
  const sizes = ctx.map((m) => estimate(m))
  let total = sizes.reduce((sum, n) => sum + n, 0)
  if (total <= budgetChars) return ctx
  let result = ctx.map((m, i) => {
    if (m.role !== 'tool') return m
    const text = String(m.content || '')
    if (text.length <= MAX_TOOL_RESULT) return m
    const cut = { ...m, content: `${text.slice(0, MAX_TOOL_RESULT)}…[truncated]` }
    total = total - sizes[i] + estimate(cut)
    sizes[i] = estimate(cut)
    return cut
  })
  while (total > budgetChars) {
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
 *   导致"一旦失败永远失败"；同时兜底 snipContext 丢弃 tool 结果后的连坐剔除）
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
  // 400 系：去掉过宽的 invalid（工具返回/业务文本含 "invalid" 会被误判为请求参数异常）
  if (/400|422|schema|validation/i.test(msg)) {
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
