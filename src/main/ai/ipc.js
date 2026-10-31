/**
 * @file: AI 模块 IPC 注册
 * 通道约定：
 *  - ai:getProviders / getPresetProviders / createProvider / updateProvider / deleteProvider / getModels
 *  - ai:chatStart（LangGraph multi-step agent；流式增量经 ai:chatChunk 推送，事件经 ai:agentEvent 推送）
 *  - ai:agentHostCall（主进程 → 渲染层：提示组装 / 工具执行 / 工作流校验）
 *  - ai:agentHostReply（渲染层 → 主进程：host 调用结果）
 *  - ai:chatAbort
 *  - ai:getMessages / deleteMessage / clearMessages
 */
import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import {
  PRESET_PROVIDERS,
  getProviderById,
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  getAllModels
} from './providers.js'
import { runAgentTurn } from './langchain/agent.js'
import { describeAIError } from '../../shared/ai-error.js'
import {
  createConversation,
  getConversations,
  deleteConversation,
  getMessages,
  saveMessage,
  deleteMessage,
  clearMessages,
  getMemories
} from './messageStore.js'
import { loadEvents, appendEvents, deleteConversationEvents, migrateConversation } from './eventStore.js'

/** requestId → { controller, sender, pending: Map<callId, {resolve, reject}> } */
const activeRequests = new Map()

/** 供应商/模型配置变更时通知所有窗口（renderer 侧 Sender 等据此刷新模型列表） */
const notifyProvidersChanged = () => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('ai:providersChanged')
  }
}

export const register = () => {
  // ---- 供应商管理 ----
  ipcMain.handle('ai:getProviders', () => listProviders())
  ipcMain.handle('ai:getPresetProviders', () => PRESET_PROVIDERS)
  ipcMain.handle('ai:createProvider', (_e, data) => {
    const result = createProvider(data)
    notifyProvidersChanged()
    return result
  })
  ipcMain.handle('ai:updateProvider', (_e, id, data) => {
    const result = updateProvider(id, data)
    notifyProvidersChanged()
    return result
  })
  ipcMain.handle('ai:deleteProvider', (_e, id) => {
    deleteProvider(id)
    notifyProvidersChanged()
  })
  ipcMain.handle('ai:getModels', () => getAllModels())

  // ---- 会话管理 ----
  ipcMain.handle('ai:createConversation', (_e, { workflowId, title }) =>
    createConversation(workflowId, title)
  )
  ipcMain.handle('ai:getConversations', (_e, { workflowId }) => getConversations(workflowId))
  ipcMain.handle('ai:deleteConversation', async (_e, { workflowId, conversationId }) => {
    await deleteConversationEvents(workflowId, conversationId)
    await deleteConversation(workflowId, conversationId)
  })

  // ---- 会话事件（append-only 事实日志） ----
  ipcMain.handle('ai:eventsLoad', (_e, { workflowId, conversationId }) =>
    loadEvents(workflowId, conversationId)
  )
  ipcMain.handle('ai:eventsAppend', (_e, { workflowId, conversationId, events }) =>
    appendEvents(workflowId, conversationId, events)
  )
  ipcMain.handle('ai:eventsDelete', (_e, { workflowId, conversationId }) =>
    deleteConversationEvents(workflowId, conversationId)
  )
  ipcMain.handle('ai:eventsMigrate', (_e, { workflowId, conversationId }) =>
    migrateConversation(workflowId, conversationId)
  )

  // ---- 聊天记录 ----
  ipcMain.handle('ai:getMessages', (_e, { workflowId, conversationId }) =>
    getMessages(workflowId, conversationId)
  )
  ipcMain.handle('ai:saveMessage', (_e, { workflowId, conversationId, message }) =>
    saveMessage(workflowId, conversationId, message)
  )
  ipcMain.handle('ai:deleteMessage', (_e, { workflowId, conversationId, messageId }) =>
    deleteMessage(workflowId, conversationId, messageId)
  )
  ipcMain.handle('ai:clearMessages', (_e, { workflowId, conversationId }) =>
    clearMessages(workflowId, conversationId)
  )

  // ---- 轻量记忆 ----
  ipcMain.handle('ai:getMemories', (_e, { workflowId }) => getMemories(workflowId))

  // ---- Agent 对话（LangGraph 主进程多步循环） ----
  ipcMain.handle('ai:chatStart', async (event, payload) => {
    const { requestId, providerId, modelId, messages, tools, turn, turnId } = payload || {}
    const provider = getProviderById(providerId)
    if (!provider) throw new Error('供应商不存在或已被删除')
    if (!provider.models?.some((m) => m.id === modelId)) {
      throw new Error(`模型 ${modelId} 不存在于该供应商，请先在模型管理中配置`)
    }

    const controller = new AbortController()
    const entry = { controller, sender: event.sender, pending: new Map() }
    activeRequests.set(requestId, entry)
    const send = (channel, data) => {
      // 窗口可能已销毁（如应用退出途中），避免推送抛错导致请求残留
      if (!event.sender.isDestroyed()) event.sender.send(channel, data)
    }

    const rejectPending = (reason) => {
      for (const pending of entry.pending.values()) pending.reject(reason)
      entry.pending.clear()
    }

    // 渲染层桥接：提示组装 / 工具执行 / 工作流校验都在渲染层完成
    const host = (method, hostPayload = {}) =>
      new Promise((resolve, reject) => {
        if (controller.signal.aborted) return reject(new Error('aborted'))
        if (event.sender.isDestroyed()) return reject(new Error('渲染窗口已关闭'))
        const callId = randomUUID()
        entry.pending.set(callId, {
          resolve: (value) => {
            entry.pending.delete(callId)
            resolve(value)
          },
          reject: (error) => {
            entry.pending.delete(callId)
            reject(error)
          }
        })
        event.sender.send('ai:agentHostCall', { requestId, callId, method, payload: hostPayload })
      })

    const onAbort = () => rejectPending(new Error('aborted'))
    controller.signal.addEventListener('abort', onAbort, { once: true })

    try {
      const { outcome } = await runAgentTurn({
        provider,
        modelId,
        turn,
        turnId,
        messages,
        tools,
        signal: controller.signal,
        host,
        onEvent: (type, data, meta) =>
          send('ai:agentEvent', {
            requestId,
            event: { type, turn: meta?.turn ?? null, step: meta?.step ?? null, data }
          }),
        onPart: (part) => send('ai:chatChunk', { requestId, part })
      })

      if (outcome?.kind === 'error') {
        send('ai:chatError', { requestId, error: outcome.error || '调用失败' })
      } else {
        send('ai:chatDone', {
          requestId,
          result: { aborted: outcome?.kind === 'aborted', outcome }
        })
      }
      return { ok: outcome?.kind !== 'error' }
    } catch (error) {
      if (controller.signal.aborted) {
        send('ai:chatDone', { requestId, result: { aborted: true } })
      } else {
        send('ai:chatError', { requestId, error: describeAIError(error) })
      }
      return { ok: false }
    } finally {
      controller.signal.removeEventListener('abort', onAbort)
      rejectPending(new Error('request finished'))
      activeRequests.delete(requestId)
    }
  })

  // 渲染层回传 host 调用结果
  ipcMain.handle('ai:agentHostReply', (_e, payload = {}) => {
    const { requestId, callId, ok, result, error } = payload
    const pending = activeRequests.get(requestId)?.pending.get(callId)
    if (!pending) return
    if (ok) pending.resolve(result)
    else pending.reject(new Error(error || '渲染层 host 调用失败'))
  })

  ipcMain.handle('ai:chatAbort', (_e, requestId) => {
    activeRequests.get(requestId)?.controller.abort()
  })
}
