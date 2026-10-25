/**
 * @file: AI 内核 - 门面
 * 组装 session / inbox / agent / llm / tools / prompt / policies，对 useAiChat 暴露最小 API。
 */
import { createSession } from './session.js'
import { createInbox } from './inbox.js'
import { createAgent } from './agent.js'
import { createLlmAdapter } from './llm.js'
import { createPromptAssembler } from './prompt.js'
import { createToolRegistry } from './tools/registry.js'
import { createToolPipeline } from './tools/pipeline.js'
import { createWorkflowGuard } from './policies/workflowGuard.js'
import { createEventPersistence } from './persistence.js'
import { createChatStream } from '@/api/aiModels'

/**
 * @param {Object} options
 * @param {string} options.workflowId
 * @param {string} options.conversationId
 * @param {Array} options.tools OpenAI 工具定义
 * @param {Object} options.executors 工具名 → 执行器
 * @param {Object} options.flowStore 工作流 store（校验用）
 * @param {Function} options.buildSystem
 * @param {Function} options.buildTurn
 * @param {Function} [options.loadMemories]
 * @param {Function} [options.onStatus]
 * @param {Function} [options.onFrame]
 * @param {Function} [options.onEvent]
 */
export const createChatKernel = ({
  workflowId,
  conversationId,
  tools = [],
  executors = {},
  flowStore,
  buildSystem,
  buildTurn,
  loadMemories,
  onStatus,
  onFrame,
  onEvent
} = {}) => {
  const persistence = createEventPersistence({ workflowId, conversationId })
  const session = createSession({ workflowId, conversationId, persistence })
  const inbox = createInbox()
  const registry = createToolRegistry({ definitions: tools, executors })
  const prompt = createPromptAssembler({ buildSystem, buildTurn, loadMemories })
  const workflowGuard = createWorkflowGuard({ flowStore })
  const llm = createLlmAdapter({ createChatStream })
  const toolsPipeline = createToolPipeline({ registry, session })

  let currentModel = null
  let lastFrame = null

  const unsubscribe = session.subscribe((event) => {
    try {
      onEvent?.(event)
    } catch (error) {
      console.error('会话事件回调失败:', error)
    }
  })

  const agent = createAgent({
    session,
    inbox,
    llm,
    registry,
    prompt,
    toolsPipeline,
    workflowGuard,
    getModel: () => currentModel,
    onStatus,
    onFrame: (frame) => {
      lastFrame = frame
      onFrame?.(frame)
    }
  })

  return {
    session,
    agent,
    /** 载入持久化事件（主进程已做幂等迁移） */
    async load() {
      const result = await persistence.load()
      session.replace(result.events || [])
      return result
    },
    setModel(model) {
      currentModel = model
    },
    getModel() {
      return currentModel
    },
    send(message) {
      agent.followup(message)
    },
    steer(message) {
      agent.steer(message)
    },
    inject(message) {
      agent.inject(message)
    },
    cancel() {
      agent.cancel()
    },
    markDeleted(messageIds, toolCallIds) {
      const event = session.markDeleted(messageIds, toolCallIds)
      persistence.flush()
      return event
    },
    deriveUi: () => session.deriveUi(),
    deriveModel: () => session.deriveModel(),
    get status() {
      return agent.status
    },
    get lastFrame() {
      return lastFrame
    },
    flush() {
      persistence.flush()
    },
    dispose() {
      unsubscribe()
      agent.cancel()
      persistence.dispose()
    }
  }
}
