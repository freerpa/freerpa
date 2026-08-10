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

/**
 * 创建流式对话（单步补全）：主进程 streamText，增量经 ai:chatChunk/ai:chatDone/ai:chatError 事件推送
 * @param {Object} payload
 * @param {string} payload.providerId 供应商 ID
 * @param {string} payload.modelId 模型 ID
 * @param {Array} payload.messages renderer 内部格式消息（user/assistant/tool）
 * @param {Array} payload.tools OpenAI 风格工具定义
 * @param {Object} handlers
 * @param {(part: {type:'text'|'reasoning'|'tool-call', ...}) => void} handlers.onChunk 流式增量
 * @param {(result: {text, reasoning, toolCalls, finishReason, aborted?}) => void} handlers.onDone 结束
 * @param {(error: Error) => void} handlers.onError 出错
 * @returns {{ start: () => Promise<void>, abort: () => void }}
 */
export const createChatStream = (payload, handlers) => {
  const requestId = uuidv4()
  const { onChunk, onDone, onError } = handlers || {}
  let unsubscribe = []
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

  const start = async () => {
    subscribe(window.electronAPI.ai.onChatChunk, ({ part }) => onChunk?.(part))
    subscribe(window.electronAPI.ai.onChatDone, ({ result }) => {
      cleanup()
      onDone?.(result)
    })
    subscribe(window.electronAPI.ai.onChatError, ({ error }) => {
      cleanup()
      onError?.(new Error(error))
    })
    try {
      await window.electronAPI.ai.chatStart({ requestId, ...payload })
    } catch (error) {
      cleanup()
      onError?.(error)
    }
  }

  const abort = () => {
    window.electronAPI.ai.chatAbort(requestId)
    cleanup()
    // 主进程 abort 后的 chatDone 事件已被退订，本地同步完成以解除 runCompletion 悬挂
    onDone?.({ aborted: true })
  }

  return { start, abort }
}
