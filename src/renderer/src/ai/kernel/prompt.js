/**
 * @file: AI 内核 - 系统提示分区组装
 * 对应 dsh core/system-prompt：
 *  - system section：稳定前缀（buildSystem），变化时才写入 system/message 事件
 *  - runtime context：每步瞬时工作流快照（buildTurn），作为 source:'runtime-context' 的 user 消息投影进模型历史、UI 不展示
 */
export const createPromptAssembler = ({ buildSystem, buildTurn, loadMemories } = {}) => {
  let lastSystem = ''

  return {
    /** 每轮开始前刷新轻量记忆（失败不阻塞对话） */
    async refresh() {
      try {
        await loadMemories?.()
      } catch (error) {
        console.warn('加载用户偏好记忆失败:', error)
      }
    },

    /**
     * 组装本次 step 的提示
     * @returns {{system:string, runtimeContext:string, systemChanged:boolean}}
     */
    assemble() {
      let system = ''
      let runtimeContext = ''
      try {
        system = buildSystem?.() || ''
      } catch (error) {
        console.warn('系统提示组装失败:', error)
      }
      try {
        runtimeContext = buildTurn?.() || ''
      } catch (error) {
        console.warn('工作流快照生成失败:', error)
      }
      const systemChanged = system !== lastSystem
      lastSystem = system
      return { system, runtimeContext, systemChanged }
    },

    reset() {
      lastSystem = ''
    }
  }
}
