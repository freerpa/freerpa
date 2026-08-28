/**
 * @file: AI 工具定义 helper — 消除各 tools 文件 `{ type:'function', function:{...} }` 重复样板
 * OpenAI 风格工具定义：{ type:'function', function: { name, description, strict?, parameters? } }
 * - 默认 strict: true（与原工具定义一致）；传 { strict: false } 可省略
 * - parameters 传入时包含（原 finish 等无参数工具不传）
 */
export const defineTool = (name, description, parameters, { strict = true } = {}) => {
  const fn = { name, description }
  if (strict) fn.strict = true
  if (parameters !== undefined) fn.parameters = parameters
  return { type: 'function', function: fn }
}
