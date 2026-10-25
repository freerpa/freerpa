/**
 * @file: AI 内核 - 上下文预算策略
 * 复用 composables/context.js 的纯函数：提交前剥离 UI 字段 → 按模型预算裁剪 → 修复 tool 配对。
 */
import {
  budgetForModel,
  snipContext,
  sanitizeContext,
  stripUiFields
} from '../../composables/context'

export { friendlyAIError } from '../../composables/context'

/**
 * @param {Array} messages deriveModelMessages 的投影结果
 * @param {{providerId:string, modelId:string}} model
 */
export const prepareRequestMessages = (messages = [], model = {}) => {
  const stripped = stripUiFields(messages)
  const snipped = snipContext(stripped, budgetForModel(model))
  return sanitizeContext(snipped)
}
