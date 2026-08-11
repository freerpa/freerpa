/**
 * @file: AI 模块 IPC 注册
 * 通道约定：
 *  - ai:getProviders / getPresetProviders / createProvider / updateProvider / deleteProvider / getModels
 *  - ai:chatStart（invoke 立即返回，流式增量经 ai:chatChunk / ai:chatDone / ai:chatError 事件推送）
 *  - ai:chatAbort
 *  - ai:getMessages / deleteMessage / clearMessages
 */
import { ipcMain, BrowserWindow } from 'electron'
import {
  PRESET_PROVIDERS,
  getProviderById,
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  getAllModels
} from './providers.js'
import { streamChat } from './chat.js'

/** 把 AI SDK / provider 错误组装成可读详情（statusCode、响应体 message 不吞） */
const describeError = (error) => {
  if (!error) return '未知错误'
  const base = error.message || error.cause?.message || String(error)
  const status = error.statusCode ?? error.cause?.statusCode
  const statusText = error.statusText || error.cause?.statusText
  const responseBody = error.responseBody ?? error.cause?.responseBody
  const parts = [base]
  if (status != null) parts.push(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`)
  // 提取响应体中的 message/error.message（OpenAI 兼容错误格式 { error: { message } }）
  if (typeof responseBody === 'string' && responseBody.length < 1000) {
    try {
      const parsed = JSON.parse(responseBody)
      const msg = parsed?.error?.message || parsed?.message
      if (typeof msg === 'string' && msg) parts.push(msg.slice(0, 300))
    } catch {
      /* 非 JSON 响应体忽略 */
    }
  }
  return parts.join(' | ')
}
import {
  createConversation,
  getConversations,
  deleteConversation,
  getMessages,
  saveMessage,
  deleteMessage,
  clearMessages,
  getMemories
} from './messages.js'

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
  ipcMain.handle('ai:deleteConversation', (_e, { workflowId, conversationId }) =>
    deleteConversation(workflowId, conversationId)
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

  // ---- 流式对话 ----
  ipcMain.handle('ai:chatStart', async (event, payload) => {
    const { requestId, providerId, modelId, messages, tools, system } = payload || {}
    const provider = getProviderById(providerId)
    if (!provider) throw new Error('供应商不存在或已被删除')
    if (!provider.models?.some((m) => m.id === modelId)) {
      throw new Error(`模型 ${modelId} 不存在于该供应商，请先在模型管理中配置`)
    }

    const controller = new AbortController()
    activeRequests.set(requestId, controller)
    const send = (channel, data) => {
      // 窗口可能已销毁（如应用退出途中），避免推送抛错导致请求残留
      if (!event.sender.isDestroyed()) event.sender.send(channel, data)
    }

    try {
      const result = await streamChat({
        provider,
        modelId,
        messages,
        tools,
        system,
        signal: controller.signal,
        onChunk: (part) => send('ai:chatChunk', { requestId, part })
      })
      send('ai:chatDone', { requestId, result })
      return { ok: true }
    } catch (error) {
      if (controller.signal.aborted) {
        // 用户主动取消：视为正常结束
        send('ai:chatDone', { requestId, result: { aborted: true } })
      } else {
        send('ai:chatError', { requestId, error: describeError(error) })
      }
      return { ok: false }
    } finally {
      activeRequests.delete(requestId)
    }
  })

  ipcMain.handle('ai:chatAbort', (_e, requestId) => {
    activeRequests.get(requestId)?.abort()
  })
}
