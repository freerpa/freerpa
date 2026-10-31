/**
 * @file: AI 调用错误 → 用户可读提示（主进程与渲染进程共用）
 * 上游原始错误必须透传：只给"模型不存在"这类归因会让用户误以为本地配置错了，
 * 实际可能是 Coding Plan 不支持该模型、订阅过期、接口地址不对等。
 */

const rawDetail = (msg) => {
  const detail = String(msg || '').replace(/\s+/g, ' ').trim()
  return detail.length > 200 ? `${detail.slice(0, 200)}…` : detail
}

/** 把 AI 调用错误转成用户可读的提示（区分认证/网络/模型等常见原因），并附带上游原文 */
export const friendlyAIError = (error) => {
  const msg = String(error?.message || error || '')
  if (!msg || msg === 'Error') return '调用失败：模型响应异常，请重试'
  const detail = rawDetail(msg)
  if (/InvalidSubscription|coding ?plan/i.test(msg)) {
    return `调用失败：供应商订阅无效或当前模型不在 Coding Plan 支持范围（${detail}）`
  }
  if (/401|403|unauthori|invalid api|apikey|api key|authentication|permission/i.test(msg)) {
    return `调用失败：API KEY 无效或已过期，请在「设置 → 模型管理」中检查供应商配置（${detail}）`
  }
  if (/404/.test(msg) && /model|not found/i.test(msg)) {
    return `调用失败：模型不存在或当前账号无权访问，请核对模型 ID 与接口地址（${detail}）`
  }
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|network error|socket/i.test(msg)) {
    return `调用失败：无法连接 AI 供应商，请检查网络与 API 地址（${detail}）`
  }
  if (/429|rate limit|too many requests/i.test(msg)) {
    return `调用失败：请求过于频繁（限流），请稍后重试（${detail}）`
  }
  // 400 系：去掉过宽的 invalid（工具返回/业务文本含 "invalid" 会被误判为请求参数异常）
  if (/400|422|schema|validation/i.test(msg)) {
    return `调用失败：请求参数异常（${detail}）`
  }
  return `调用失败：${detail}`
}

/** 把模型/网络异常组装成可读详情（statusCode、响应体 message 不吞） */
export const describeAIError = (error) => {
  if (!error) return '未知错误'
  const base = error.message || error.cause?.message || String(error)
  const status = error.statusCode ?? error.cause?.statusCode
  const statusText = error.statusText || error.cause?.statusText
  const responseBody = error.responseBody ?? error.cause?.responseBody
  const parts = [base]
  if (status != null) parts.push(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`)
  // 提取响应体中的 message/error.message（OpenAI 兼容错误格式 { error: { message } }）
  if (typeof responseBody === 'string' && responseBody.length < 1000) {
    try {
      const parsed = JSON.parse(responseBody)
      const msg = parsed?.error?.message || parsed?.message
      if (typeof msg === 'string' && msg) parts.push(msg.slice(0, 300))
    } catch {
      /* 非 JSON 响应体忽略 */
    }
  }
  return parts.join(' | ')
}
