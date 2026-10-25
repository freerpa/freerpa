/**
 * @file: AI 会话状态机（多会话）—— dsh 内核适配层
 * 职责收敛为：会话列表 / 切换 / 视图响应式 / 实时帧叠加 / 用户操作转发。
 * turn/step、工具管线、事件日志、提示组装均在 ./kernel 中实现（不依赖 Vue）。
 *
 * 视图契约保持：messages（不含 tool）、allMessages（含 tool）、_usage、round_id、tool_calls 等字段
 * 由 kernel/projections.js 从事件投影，Bubble/ToolCard/buildRoundGroups 无需感知事件模型。
 */
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { Message } from '@arco-design/web-vue'
import {
  createConversation,
  getConversations,
  deleteConversation
} from '@/api/aiModels'
import { createChatKernel } from '../kernel/index'
import { useFlowStore } from '@/workflow/store'
import { toPlain } from '../../utils/deepCopy.js'

export const useAiChat = ({ workflowId, tools, executors, buildSystem, buildTurn, scrollToBottom }) => {
  const flowStore = useFlowStore(workflowId)
  const conversations = ref([])
  const currentConversationId = ref('')
  const loading = ref(false)
  const eventsVersion = ref(0)
  const liveMessage = ref(null)

  const kernels = new Map() // conversationId → kernel（切换会话保留后台执行）
  const statuses = new Map() // conversationId → 'idle' | 'running'
  let activeConversationId = ''

  const activeKernel = () => kernels.get(activeConversationId) || null

  const allMessages = computed(() => {
    // 依赖事件版本：事件是普通数组（非响应式），版本号用于触发重算
    void eventsVersion.value
    const kernel = activeKernel()
    const base = kernel ? kernel.deriveUi() : []
    const live = liveMessage.value
    return live ? [...base, live] : base
  })
  const messages = computed(() => allMessages.value.filter((m) => m.role !== 'tool'))

  const refreshConversations = async () => {
    try {
      conversations.value = (await getConversations(workflowId)) || []
    } catch (error) {
      console.error('获取会话列表失败:', error)
    }
  }

  const updateLoading = () => {
    loading.value = statuses.get(activeConversationId) === 'running'
  }

  const applyLiveFrame = (frame) => {
    if (frame.kind === 'start') {
      liveMessage.value = {
        message_id: frame.attemptId,
        round_id: frame.turnId,
        _ts: Date.now(),
        role: 'assistant',
        content: '',
        reasoning_content: '',
        tool_calls: [],
        tool_calling: '',
        loading: true
      }
      return
    }
    if (frame.kind === 'end') {
      liveMessage.value = null
      return
    }
    const live = liveMessage.value
    if (!live) return
    const chunk = frame.chunk
    if (chunk.type === 'text-delta') live.content += chunk.text || ''
    else if (chunk.type === 'reasoning-delta') live.reasoning_content += chunk.text || ''
    else if (chunk.type === 'tool-call') {
      live.tool_calling = 'loading'
      upsertToolCall(live, chunk)
    } else if (chunk.type === 'tool-call-delta') {
      upsertToolArg(live, chunk)
    }
    scrollToBottom?.()
  }

  const upsertToolCall = (message, chunk) => {
    const calls = message.tool_calls || []
    const index = calls.findIndex((call) => call.id === chunk.callId)
    const call = {
      id: chunk.callId,
      type: 'function',
      function: { name: chunk.name || '', arguments: chunk.input ?? {} }
    }
    if (index === -1) calls.push(call)
    else calls[index] = call
    message.tool_calls = calls
  }

  const upsertToolArg = (message, chunk) => {
    const calls = message.tool_calls || []
    const call = calls.find((item) => item.id === chunk.callId)
    if (call) {
      call._argsDelta = (call._argsDelta || '') + (chunk.delta || '')
    } else {
      calls.push({
        id: chunk.callId,
        type: 'function',
        function: { name: '', arguments: {} },
        _argsDelta: chunk.delta || ''
      })
      message.tool_calls = calls
    }
  }

  const createKernel = (conversationId) => {
    const kernel = createChatKernel({
      workflowId,
      conversationId,
      tools,
      executors,
      flowStore,
      buildSystem,
      buildTurn,
      loadMemories: undefined,
      onStatus: (status) => {
        statuses.set(conversationId, status)
        if (conversationId === activeConversationId) updateLoading()
      },
      onFrame: (frame) => {
        if (conversationId !== activeConversationId) return
        applyLiveFrame(frame)
      },
      onEvent: (event) => {
        eventsVersion.value += 1
        if (conversationId !== activeConversationId) return
        if (event.type === 'user/message' && event.data?.source !== 'runtime-context') {
          scheduleConversationRefresh()
        }
        if (event.type === 'turn/end') {
          scheduleConversationRefresh()
          if (liveMessage.value) liveMessage.value = null
        }
        scrollToBottom?.()
      }
    })
    kernels.set(conversationId, kernel)
    return kernel
  }

  let conversationRefreshTimer = null
  const scheduleConversationRefresh = () => {
    if (conversationRefreshTimer) return
    conversationRefreshTimer = setTimeout(async () => {
      conversationRefreshTimer = null
      await refreshConversations()
    }, 300)
  }

  const openConversation = async (conversationId) => {
    if (activeConversationId) kernels.get(activeConversationId)?.flush()
    activeConversationId = conversationId
    currentConversationId.value = conversationId
    liveMessage.value = null
    let kernel = kernels.get(conversationId)
    if (!kernel) {
      kernel = createKernel(conversationId)
      try {
        await kernel.load()
      } catch (error) {
        console.error('加载会话事件失败:', error)
      }
    }
    eventsVersion.value += 1
    updateLoading()
  }

  const init = async () => {
    await refreshConversations()
    let current = conversations.value[0]?.id
    if (!current) {
      try {
        const conv = await createConversation(workflowId)
        current = conv.id
        await refreshConversations()
      } catch {
        current = 'default'
      }
    }
    await openConversation(current)
  }

  const newConversation = async () => {
    try {
      const conv = await createConversation(workflowId)
      await refreshConversations()
      await openConversation(conv.id)
      scrollToBottom?.()
    } catch (error) {
      console.error('新建对话失败:', error)
    }
  }

  const switchConversation = async (conversationId) => {
    if (conversationId === currentConversationId.value) return
    await openConversation(conversationId)
    scrollToBottom?.()
  }

  const removeConversation = async (conversationId) => {
    try {
      const kernel = kernels.get(conversationId)
      kernel?.dispose()
      kernels.delete(conversationId)
      statuses.delete(conversationId)
      await deleteConversation(workflowId, conversationId)
      await refreshConversations()
      if (conversationId === currentConversationId.value) {
        activeConversationId = ''
        const next = conversations.value[0]?.id
        if (next) await openConversation(next)
        else await newConversation()
      }
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }

  const send = async ({ id: messageId, model, content, attachments }) => {
    const kernel = activeKernel()
    if (!kernel) return
    if (loading.value) return
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0
    if (!content?.trim() && !hasAttachments) return
    if (!model?.providerId || !model?.modelId) {
      Message.warning('请先在输入框选择模型')
      return
    }
    kernel.setModel(model)
    kernel.send({
      message_id: messageId || uuidv4(),
      role: 'user',
      content: content || '',
      attachments: hasAttachments ? toPlain(attachments) : undefined
    })
  }

  const cancel = () => {
    activeKernel()?.cancel()
    liveMessage.value = null
    updateLoading()
  }

  const removeMessage = async (index) => {
    const message = messages.value[index]
    if (!message) return
    if (message.loading) {
      Message.warning('当前消息正在回复中，不能删除')
      return
    }
    const kernel = activeKernel()
    if (!kernel) return
    const toolCallIds =
      message.role === 'assistant'
        ? (message.tool_calls || []).map((call) => call.id).filter(Boolean)
        : []
    kernel.markDeleted([message.message_id], toolCallIds)
  }

  const disposeAll = () => {
    kernels.forEach((kernel) => kernel.dispose())
    kernels.clear()
    statuses.clear()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => kernels.forEach((kernel) => kernel.flush()))
  }

  return {
    messages,
    allMessages,
    conversations,
    currentConversationId,
    loading,
    init,
    newConversation,
    switchConversation,
    removeConversation,
    send,
    cancel,
    removeMessage,
    disposeAll
  }
}
