/**
 * @file: AI 内核 - 循环守卫策略
 * 承接原 toolLoop.js 的失败指纹 / 无进展轮数 / 轮次上限语义。
 */

export const MAX_LOOP_GUARD_FAILURES = 2 // 同一工具同一参数连续失败次数 → 阻断循环
export const STALL_ROUNDS = 3 // 连续失败/无进展轮数上限 → 提示输出结论并结束
export const MAX_TOOL_ROUNDS = 128 // turn 内 step 上限
export const MAX_FINAL_FIX_ROUNDS = 5 // 工作流校验最终兜底修正轮数

export const LOOP_GUARD_MSG =
  'blocked: [loop guard] 同一工具调用已连续失败，请停止重试并修正参数或改用其他方式，然后直接输出阶段性结论或询问用户'
export const STALL_PROMPT_MSG =
  '提示：已连续 3 轮工具调用失败/无进展，请停止重试，基于已有信息输出阶段性结论，或向用户询问下一步操作，不要再调用工具。'
export const GRACE_PROMPT_MSG =
  '提示：已达到工具调用轮次上限。请基于已完成的工具结果直接输出最终回复，不要再调用工具。'

/** 每个 turn 一份守卫状态（跨 step 保留，turn 结束丢弃） */
export const createLoopGuard = () => {
  const failureFingerprints = new Map()
  let stalledRounds = 0

  return {
    /** 记录一次工具失败，返回是否应阻断工具阶段 */
    recordFailure(call) {
      const fingerprint = `${call.name}|${JSON.stringify(call.arguments || {})}`
      const count = (failureFingerprints.get(fingerprint) || 0) + 1
      failureFingerprints.set(fingerprint, count)
      return count >= MAX_LOOP_GUARD_FAILURES
    },
    /** 一轮工具执行结束后更新无进展计数，返回当前连续失败轮数 */
    recordRound(failed) {
      stalledRounds = failed ? stalledRounds + 1 : 0
      return stalledRounds
    },
    get stalledRounds() {
      return stalledRounds
    }
  }
}
