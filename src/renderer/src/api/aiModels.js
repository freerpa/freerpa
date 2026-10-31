/**
 * @file: AI 模型接口（主进程 IPC 版）
 * 供应商管理 / 模型列表 / 流式对话 / 聊天记录
 */
import { v4 as uuidv4 } from 'uuid'

// ---- 供应商管理（设置页 - 模型管理使用） ----
export const getProviders = () => window.electronAPI.ai.getProviders()
export const getPresetProviders = () => window.electronAPI.ai.getPresetProviders()
export const createProvider = (data) => window.electronAPI.ai.createProvider(data)
export const updateProvider = (id, data) => window.electronAPI.ai.updateProvider(id, data)
export const deleteProvider = (id) => window.electronAPI.ai.deleteProvider(id)

// ---- 模型列表（汇总所有供应商，Sender 模型下拉使用） ----
export const getModels = () => window.electronAPI.ai.getModels()

// ---- 聊天记录（多会话） ----
export const createConversation = (workflowId) => window.electronAPI.ai.createConversation(workflowId)
export const getConversations = (workflowId) => window.electronAPI.ai.getConversations(workflowId)
export const deleteConversation = (workflowId, conversationId) =>
  window.electronAPI.ai.deleteConversation(workflowId, conversationId)
export const getChatMessages = (workflowId, conversationId) =>
  window.electronAPI.ai.getMessages(workflowId, conversationId)
export const deleteChatMessages = ({ workflowId, conversationId, messageId }) => {
  // 传了 messageId 删除单条，否则清空整个会话记录
  return messageId
    ? window.electronAPI.ai.deleteMessage(workflowId, conversationId, messageId)
    : window.electronAPI.ai.clearMessages(workflowId, conversationId)
}

// ---- 会话事件日志（append-only） ----
export const loadEvents = (workflowId, conversationId) =>
  window.electronAPI.ai.loadEvents(workflowId, conversationId)
export const appendEvents = (workflowId, conversationId, events) =>
  window.electronAPI.ai.appendEvents(workflowId, conversationId, events)
export const deleteEvents = (workflowId, conversationId) =>
  window.electronAPI.ai.deleteEvents(workflowId, conversationId)
export const migrateEvents = (workflowId, conversationId) =>
  window.electronAPI.ai.migrateEvents(workflowId, conversationId)

/**
 * 创建一次 Agent turn（主进程 LangGraph 多步循环）
 * - 流式增量：ai:chatChunk
 * - 事件事实：ai:agentEvent
 * - 渲染层 host 调用：ai:agentHostCall → 执行后 ai:agentHostReply
 * @param {Object} payload
 * @param {string} payload.providerId
 * @param {string} payload.modelId
 * @param {number} payload.turn
 * @param {string} payload.turnId
 * @param {Array} payload.messages renderer 内部格式消息（user/assistant/tool）
 * @param {Array} payload.tools OpenAI 风格工具定义
 * @param {Object} handlers
 * @param {(part:Object)=>void} handlers.onPart 流式增量
 * @param {(event:Object)=>void} handlers.onEvent 事件
 * @param {(method:string, payload:Object)=>Promise<any>} handlers.onHostCall host 调用
 * @param {(result:Object)=>void} handlers.onDone 结束
 * @param {(error:Error)=>void} handlers.onError 出错
 * @returns {{ start: () => Promise<void>, abort: () => void }}
 */
export const createAgentRun = (payload, handlers) => {
  const requestId = uuidv4()
  const { onPart, onEvent, onHostCall, onDone, onError } = handlers || {}
  let unsubscribe = []
  let finished = false
  const cleanup = () => {
    unsubscribe.forEach((off) => off())
    unsubscribe = []
  }
  const subscribe = (on, cb) => {
    const off = on((data) => {
      if (data.requestId === requestId) cb(data)
    })
    unsubscribe.push(off)
  }
  const finish = (fn, value) => {
    if (finished) return
    finished = true
    cleanup()
    fn?.(value)
  }

  const start = async () => {
    subscribe(window.electronAPI.ai.onChatChunk, ({ part }) => onPart?.(part))
    subscribe(window.electronAPI.ai.onAgentEvent, ({ event }) => onEvent?.(event))
    subscribe(window.electronAPI.ai.onAgentHostCall, async ({ callId, method, payload: hostPayload }) => {
      try {
        const result = await onHostCall?.(method, hostPayload)
        await window.electronAPI.ai.agentHostReply({ requestId, callId, ok: true, result })
      } catch (error) {
        await window.electronAPI.ai.agentHostReply({
          requestId,
          callId,
          ok: false,
          error: error?.message || String(error)
        })
      }
    })
    subscribe(window.electronAPI.ai.onChatDone, ({ result }) => finish(onDone, result))
    subscribe(window.electronAPI.ai.onChatError, ({ error }) =>
      finish(onError, new Error(error))
    )
    try {
      await window.electronAPI.ai.chatStart({ requestId, ...payload })
    } catch (error) {
      finish(onError, error)
    }
  }

  const abort = () => {
    // 主进程收到 abort 后会补发中断 attempt 事件并回 chatDone，这里保持订阅等待收尾
    window.electronAPI.ai.chatAbort(requestId)
  }

  return { start, abort }
}
