/**
 * @file: AI 内核 - 工作流校验策略
 * 承接原 useAiChat 中的 quickValidateWorkflow 检查：每次模型给出无工具调用答复时校验当前画布，
 * 未通过则把问题清单作为 next-step 输入注入，直到通过或达到兜底修正轮数。
 *
 * 完成契约：本 turn 只要发生过工作流变更，就必须成功调用 finish 才算结束；
 * 模型仅输出文字（漏掉剩余步骤、未调用 finish）时注入续跑指令，避免“任务没做完会话就停了”。
 */
import { quickValidateWorkflow } from '@/workflow/engine/validate'
import { MAX_FINAL_FIX_ROUNDS } from './loopGuard'

export const CONTINUE_MESSAGE =
  '【任务尚未完成】你已经改动了工作流，但还没有成功调用 finish。请继续完成剩余步骤（创建/连接/配置节点），' +
  '每完成一步都用工具推进；确认全部需求已实现且工作流校验通过后，再调用 finish。不要在这里停下等待用户说“继续”。'

export const createWorkflowGuard = ({ flowStore, maxFixRounds = MAX_FINAL_FIX_ROUNDS } = {}) => {
  let fixRounds = 0
  let mutations = 0
  let finished = false

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
      mutations = 0
      finished = false
    },
    /** 记录一次成功的工作流变更（addNode/connect/updateNode/deleteNode/deleteEdge） */
    markMutation() {
      mutations += 1
      finished = false
    },
    /** 记录 finish 成功（本 turn 的完成信号） */
    markFinished() {
      finished = true
    },
    /** 有变更但尚未 finish 成功 → 需要继续，不能直接结束 */
    needsFinish: () => mutations > 0 && !finished,
    buildRepairMessage(errors = []) {
      return `【工作流校验未通过】请继续修复以下问题，全部通过后再输出最终回复：\n${errors
        .map((e) => `- ${e.message}`)
        .join('\n')}`
    }
  }
}
