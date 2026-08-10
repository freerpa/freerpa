/**
 * @file: 工具结果输出护栏（head/tail 两端保留，参照 Reasonix tool result snip）
 */
export const MAX_OUTPUT = 20000 // 单条工具结果上限（字符）

/** 超长文本 head/tail 截断：两端各保留一部分，中间标注截断字节数与重试指引 */
export const limitText = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text.length <= MAX_OUTPUT) return text
  const head = Math.floor(MAX_OUTPUT * 0.7)
  const tail = MAX_OUTPUT - head
  const omitted = text.length - MAX_OUTPUT
  return `${text.slice(0, head)}…[truncated ${omitted} bytes — 需要完整数据请缩小查询范围或加条件过滤]…${text.slice(-tail)}`
}
