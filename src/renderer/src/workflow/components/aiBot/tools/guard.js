/**
 * @file: 工具结果输出护栏（head/tail 两端保留，参照 Reasonix tool result snip）
 * 同时收敛跨模块复用的敏感信息脱敏与参数必填校验。
 */
export const MAX_OUTPUT = 20000 // 单条工具结果上限（字符）；useAiChat 上下文预算的单条 tool 结果截断复用此值

/** 超长文本 head/tail 截断：两端各保留一部分，中间标注截断字节数与重试指引 */
export const limitText = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text.length <= MAX_OUTPUT) return text
  const head = Math.floor(MAX_OUTPUT * 0.7)
  const tail = MAX_OUTPUT - head
  const omitted = text.length - MAX_OUTPUT
  return `${text.slice(0, head)}…[truncated ${omitted} bytes — 需要完整数据请缩小查询范围或加条件过滤]…${text.slice(-tail)}`
}

/** 敏感字段匹配（apiKey/password/token/secret 等；chat.vue 快照与 workflow.js 返回脱敏共用） */
const SENSITIVE_KEYS = /api[_-]?key|password|passwd|token|secret|authorization|cookie|appid|app[_-]?secret/i

/** config 深度脱敏：敏感字段（apiKey/password/token/secret 等）值打码（防明文配置发给第三方模型） */
export const maskSensitive = (config) => {
  if (!config || typeof config !== 'object') return config
  if (Array.isArray(config)) return config.map(maskSensitive)
  const out = {}
  Object.keys(config).forEach((k) => {
    const v = config[k]
    if (typeof v === 'string' && v && SENSITIVE_KEYS.test(k)) {
      out[k] = v.length > 8 ? `${v.slice(0, 4)}****${v.slice(-2)}` : '****'
    } else if (v && typeof v === 'object') {
      out[k] = maskSensitive(v)
    } else {
      out[k] = v
    }
  })
  return out
}

/** 必填参数校验：缺失/空值抛错（错误消息进入模型上下文，统一英文格式） */
export const assertArgs = (args = {}, keys) => {
  keys.forEach((key) => {
    if (args[key] === undefined || args[key] === null || args[key] === '') {
      throw new Error(`${key} is required`)
    }
  })
}
