/**
 * @file: AI 内核 - 工作流校验策略
 * 承接原 useAiChat 中的 quickValidateWorkflow 检查：每次模型给出无工具调用答复时校验当前画布，
 * 未通过则把问题清单作为 next-step 输入注入，直到通过或达到兜底修正轮数。
 */
import { quickValidateWorkflow } from '@/workflow/engine/validate'
import { MAX_FINAL_FIX_ROUNDS } from './loopGuard'

export const createWorkflowGuard = ({ flowStore, maxFixRounds = MAX_FINAL_FIX_ROUNDS } = {}) => {
  let fixRounds = 0

  const inspect = () => {
    try {
      const result = quickValidateWorkflow(flowStore)
      return result?.ok ? null : result?.errors || []
    } catch (error) {
      // 画布未就绪时跳过校验，不影响对话
      console.warn('工作流快照校验失败（画布可能未就绪）:', error)
      return null
    }
  }

  return {
    inspect,
    canFix: () => fixRounds < maxFixRounds,
    consumeFix() {
      fixRounds += 1
    },
    reset() {
      fixRounds = 0
    },
    buildRepairMessage(errors = []) {
      return `【工作流校验未通过】请继续修复以下问题，全部通过后再输出最终回复：\n${errors
        .map((e) => `- ${e.message}`)
        .join('\n')}`
    }
  }
}
