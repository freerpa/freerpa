/**
 * @file: AI 内核 - 工具注册表
 * 对应 dsh core/tools 的 scoped registry（精简）：只读工具标记并发安全，其余默认串行。
 */
const READ_ONLY_PATTERN = /^(list|get|query|search|read|describe)/i

export const isConcurrencySafeTool = (name = '') =>
  READ_ONLY_PATTERN.test(name) && name !== 'finish'

/**
 * @param {{definitions:Array, executors:Object}} options
 * definitions 为 OpenAI function 定义；executors 为 工具名 → async (args) => output
 */
export const createToolRegistry = ({ definitions = [], executors = {} } = {}) => {
  const byName = new Map()
  for (const definition of definitions) {
    const name = definition?.function?.name
    if (name) byName.set(name, definition)
  }

  return {
    get definitions() {
      return definitions
    },
    byName,
    executors,
    isConcurrencySafe: (name) => isConcurrencySafeTool(name),
    /** 一次 step 的工具集快照（保留 dsh dispose 语义，当前无动态作用域工具） */
    resolve() {
      return {
        tools: definitions,
        dispose() {}
      }
    }
  }
}
