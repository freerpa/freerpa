/**
 * @file: AI 内核 - inbox（双队列输入）
 * 与 dsh core/agent-loop/inbox 对齐：
 *  - followup: 下一 turn 处理（普通用户消息），并唤醒 driver
 *  - steer / inject: 下一 step 处理（修复指令、校验提示等）；inject 不唤醒
 */
export const createInbox = ({ onWake } = {}) => {
  let nextTurn = []
  let nextStep = []

  const wake = () => onWake?.()

  return {
    followup(message) {
      nextTurn.push(message)
      wake()
    },
    steer(message) {
      nextStep.push(message)
      wake()
    },
    inject(message) {
      nextStep.push(message)
    },
    /** 取走目标队列全部消息；target 为 'next-turn' 或 'next-step' */
    claim(target = 'next-step') {
      if (target === 'next-turn') {
        const batch = nextTurn
        nextTurn = []
        return batch
      }
      const batch = nextStep
      nextStep = []
      return batch
    },
    splice(target = 'next-step') {
      if (target === 'next-turn') nextTurn = []
      else nextStep = []
    },
    clear() {
      nextTurn = []
      nextStep = []
    },
    get nextTurn() {
      return nextTurn
    },
    get nextStep() {
      return nextStep
    },
    hasPending() {
      return nextTurn.length > 0 || nextStep.length > 0
    }
  }
}
