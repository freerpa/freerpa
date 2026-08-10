/**
 * @file: AI 会话状态机（多会话）
 * 职责：会话列表 / 新建会话 / 切换会话 / 消息列表 / 流式增量拼接 / 工具调用循环 / 取消 / 删除
 * 会话模型：ai_conversations（id, workflow_id, title）；消息按 conversation_id 隔离
 * 消息模型（与 sqlite 表一致，OpenAI 风格 tool_calls）：
 *   user:      { message_id, role, content, attachments? }
 *   assistant: { message_id, role, content, reasoning_content, tool_calls: [{id,type,function:{name,arguments}}] }
 *   tool:      { message_id, role, tool_call_id, tool_name, content }（仅入上下文与持久化，UI 不渲染气泡）
 * 纯函数层（上下文加工/错误映射）见 ./context.js，工具执行与循环守卫见 ./toolLoop.js
 */
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { Message } from '@arco-design/web-vue'
import {
  createChatStream,
  getChatMessages,
  deleteChatMessages,
  createConversation,
  getConversations,
  deleteConversation
} from '@/api/aiModels'
import { snipContext, sanitizeContext, friendlyAIError, toOpenAiToolCall } from './context'
import { executeToolCalls, STALL_ROUNDS, STALL_PROMPT_MSG, GRACE_PROMPT_MSG } from './toolLoop'
import { useFlowStore } from '@/workflow/store'
import { quickValidateWorkflow } from '@/workflow/engine/validate'

const MAX_TOOL_ROUNDS = 128 // 工具循环轮次上限，防止模型死循环（含每轮结束前的工作流检测修正轮）

export const useAiChat = ({ workflowId, tools, executors, buildSystem, buildTurn, scrollToBottom }) => {
  const flowStore = useFlowStore(workflowId)
  const messages = ref([]) // 当前会话消息（含 tool，供上下文与持久化）
  const conversations = ref([]) // 会话列表 [{ id, title, messageCount, updatedAt }]
  const currentConversationId = ref('')
  const loading = ref(false)
  const displayMessages = computed(() => messages.value.filter((m) => m.role !== 'tool'))

  let chatStream = null
  let cancelFlag = false
  let contextMessages = [] // 提交给模型的完整上下文（含 tool 结果）

  const refreshConversations = async () => {
    try {
      conversations.value = (await getConversations(workflowId)) || []
    } catch (error) {
      console.error('获取会话列表失败:', error)
    }
  }

  const loadMessages = async (conversationId) => {
    try {
      // 历史消息持久化的 token 用量（DB usage 列）映射为运行时 _usage，供统计/气泡统一读取
      messages.value = ((await getChatMessages(workflowId, conversationId)) || []).map((m) => ({
        ...m,
        _usage: m.usage || null
      }))
      // JSON 深拷贝：messages.value 是 Vue reactive 数组，元素为 Proxy，
      // 直接经 IPC 传输会因 structuredClone 无法克隆 Proxy 报 "An object could not be cloned"
      contextMessages = JSON.parse(JSON.stringify(messages.value))
    } catch (error) {
      console.error('获取聊天记录失败:', error)
    }
  }

  // ---- 会话初始化 / 切换 ----
  const init = async () => {
    await refreshConversations()
    let current = conversations.value[0]?.id
    if (!current) {
      // 无任何会话 → 自动创建首个会话
      try {
        const conv = await createConversation(workflowId)
        current = conv.id
        await refreshConversations()
      } catch {
        current = 'default'
      }
    }
    currentConversationId.value = current
    await loadMessages(current)
  }

  /** 新建对话：创建新会话并切换（不清空已有会话） */
  const newConversation = async () => {
    try {
      const conv = await createConversation(workflowId)
      currentConversationId.value = conv.id
      await refreshConversations()
      messages.value = []
      contextMessages = []
      scrollToBottom?.()
    } catch (error) {
      console.error('新建对话失败:', error)
    }
  }

  /** 切换会话 */
  const switchConversation = async (conversationId) => {
    if (conversationId === currentConversationId.value) return
    currentConversationId.value = conversationId
    await loadMessages(conversationId)
    scrollToBottom?.()
  }

  /** 删除会话（含其消息）；删除当前会话后自动切换到最新会话 */
  const removeConversation = async (conversationId) => {
    try {
      await deleteConversation(workflowId, conversationId)
      await refreshConversations()
      if (conversationId === currentConversationId.value) {
        const next = conversations.value[0]?.id
        if (next) {
          currentConversationId.value = next
          await loadMessages(next)
        } else {
          await newConversation()
        }
      }
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }

  // ---- 删除 / 清空（当前会话内） ----
  const removeMessage = async (index) => {
    const msg = displayMessages.value[index]
    if (!msg) return
    if (msg.loading) {
      Message.warning('当前消息正在回复中，不能删除')
      return
    }
    try {
      await deleteChatMessages({
        workflowId,
        conversationId: currentConversationId.value,
        messageId: msg.message_id
      })
      messages.value = messages.value.filter((m) => m.message_id !== msg.message_id)
      // 删除 assistant 时连带清理其工具结果消息（tool 消息不展示，但残留会破坏上下文配对）
      const toolIds = new Set(
        (msg.role === 'assistant' ? msg.tool_calls || [] : []).map((tc) => tc.id)
      )
      const orphanIds = []
      contextMessages = contextMessages.filter((m) => {
        if (m.message_id === msg.message_id) return false
        if (m.role === 'tool' && toolIds.has(m.tool_call_id)) {
          orphanIds.push(m.message_id)
          return false
        }
        return true
      })
      await Promise.all(
        orphanIds.map((id) =>
          deleteChatMessages({ workflowId, conversationId: currentConversationId.value, messageId: id }).catch(() => {})
        )
      )
    } catch (error) {
      console.error('删除聊天记录失败:', error)
    }
  }

  // ---- 取消 ----
  const cancel = () => {
    cancelFlag = true
    if (chatStream) {
      chatStream.abort()
      chatStream = null
    }
  }

  /** 单轮补全：流式增量写回 assistant，结束时 resolve {toolCalls} */
  const runCompletion = (assistant, model) =>
    new Promise((resolve, reject) => {
      // 提交内容：清洗配对 + 上下文预算；瞬时快照（buildTurn）以 user 消息追加在末尾，不持久化
      const base = sanitizeContext(snipContext(contextMessages))
      const messages = buildTurn
        ? [...base, { role: 'user', message_id: `snapshot-${Date.now()}`, content: buildTurn() }]
        : base
      // IPC 前深拷贝为纯对象：contextMessages 元素可能含 Vue reactive proxy——
      // （reactive 数组 push 会把元素包装成 proxy；经 viewRound（proxy）修改的 tool_calls
      // 底层数组元素也会被 Vue 包装），structuredClone 无法克隆 proxy，直接传会报
      // 「An object could not be cloned」（曾出现在 aiModels.start 的 chatStart）
      const payloadMessages = JSON.parse(JSON.stringify(messages))
      chatStream = createChatStream(
        {
          providerId: model.providerId,
          modelId: model.modelId,
          messages: payloadMessages,
          tools,
          system: buildSystem()
        },
        {
          onChunk: (part) => {
            if (part.type === 'text') {
              assistant.content += part.text
            } else if (part.type === 'reasoning') {
              assistant.reasoning_content += part.text
            } else if (part.type === 'tool-call') {
              // 实时展示（最终以 onDone 的完整 toolCalls 为准）
              assistant.tool_calling = 'loading'
              upsertToolCall(assistant, part)
            } else if (part.type === 'tool-arg') {
              // 参数流式增量（部分 provider 只发 delta 不发完整 input）：实时拼接展示
              upsertToolArg(assistant, part)
            }
            scrollToBottom?.()
          },
          onDone: (result) => {
            chatStream = null
            if (!result.aborted) {
              // 完整文本兜底：流式 part 未拼到内容时（个别 provider 行为差异），用结果值回填，避免空回复
              if (result.text && !assistant.content) assistant.content = result.text
              if (result.reasoning && !assistant.reasoning_content) {
                assistant.reasoning_content = result.reasoning
              }
              // token 用量 / 结束原因（展示用，非持久化字段）
              assistant._usage = result.usage || null
              assistant._finishReason = result.finishReason || ''
            }
            resolve({ aborted: !!result.aborted, toolCalls: result.toolCalls || [] })
          },
          onError: (error) => {
            chatStream = null
            reject(error)
          }
        }
      )
      chatStream.start()
    })

  const upsertToolCall = (assistant, part) => {
    const calls = assistant.tool_calls || []
    const index = calls.findIndex((c) => c.id === part.toolCallId)
    const call = toOpenAiToolCall(part)
    if (index === -1) calls.push(call)
    else calls[index] = call
  }

  /** 工具参数流式增量：拼接到对应 call 的 _argsDelta（展示用，onDone 覆盖 tool_calls 后自动失效） */
  const upsertToolArg = (assistant, part) => {
    const calls = assistant.tool_calls || []
    const call = calls.find((c) => c.id === part.toolCallId)
    if (call) {
      call._argsDelta = (call._argsDelta || '') + (part.arg || '')
    } else {
      // delta 先于完整 call 到达：先建占位卡片
      calls.push({
        id: part.toolCallId,
        type: 'function',
        function: { name: '', arguments: {} },
        _argsDelta: part.arg || ''
      })
    }
  }

  // ---- 发送（工具调用 while 循环） ----
  const send = async ({ id: messageId, model, content, attachments }) => {
    if (loading.value) return
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0
    if (!content?.trim() && !hasAttachments) return
    loading.value = true
    cancelFlag = false

    // 快照本轮会话 ID：流式进行中即使切换/删除会话，本轮消息仍写回原会话
    const convId = currentConversationId.value
    // 统一深拷贝为纯对象再传 IPC：persistIn 可能收到 messages 数组里的 reactive proxy 元素
    // （Vue Proxy 无法被 structuredClone 克隆，直接传会报「An object could not be cloned」）
    const persistIn = (msg) =>
      window.electronAPI.ai
        .saveMessage(workflowId, convId, JSON.parse(JSON.stringify(msg)))
        .catch(() => {})

    // 用户消息（attachments 持久化展示，且仅入上下文不重复拼接）；
    // round_id：一次用户指令 = 一个轮次，该指令产生的全部消息（多次思考/工具调用/回复）共享同一 round_id，UI 据此分组
    const roundId = uuidv4()
    const userMsg = {
      message_id: messageId,
      round_id: roundId,
      _ts: Date.now(),
      role: 'user',
      content: content || '',
      attachments: hasAttachments ? attachments : undefined
    }
    messages.value.push(userMsg)
    contextMessages.push(userMsg)
    // 不 await：用户消息持久化异步完成（persistIn 已吞错），
    // 立即继续创建 assistant 加载框——否则要等 IPC 落库后才显示回复加载，体验上"等到大模型响应"
    persistIn(userMsg)

    // 每轮补全独立一条 assistant 消息（推理/工具调用/文本属于同一时间单元）。
    // 此前多轮工具调用聚合到同一条消息，UI 上所有推理堆在一起、时间错位，用户阅读困难；
    // 拆分后每条 assistant 消息 = 一轮（工具轮显示推理+工具卡片，最终轮显示推理+文本），时间顺序清晰
    const beginRound = (prevRound) => {
      // 切换轮次前先持久化上一轮完整状态（幂等覆盖其空骨架）——
      // 否则中间工具轮次只保存了空消息，历史恢复后 tool_calls/流式内容丢失，工具调用记录不全
      if (prevRound) persistIn(prevRound)
      const roundAssistant = {
        message_id: uuidv4(),
        round_id: roundId,
        _ts: Date.now(),
        role: 'assistant',
        content: '',
        reasoning_content: '',
        tool_calls: [],
        tool_calling: '',
        loading: true
      }
      messages.value.push(roundAssistant)
      // viewRound = reactive proxy（数组元素）。流式增量必须经 proxy 赋值才能触发
      // Vue 响应式更新（直接改原始对象不经过 setter，视图不刷新 → 表现为"无流式、一次性出全文"）
      const viewRound = messages.value[messages.value.length - 1]
      // assistant 原始对象进请求上下文（proxy 传 IPC 会 structuredClone 失败）
      contextMessages.push(roundAssistant)
      // 先持久化空骨架：循环中途窗口关闭也不残留孤立 tool 消息（INSERT OR REPLACE 幂等，最终态会覆盖）
      persistIn(roundAssistant)
      scrollToBottom?.()
      return viewRound
    }
    // 当前轮 assistant 消息（reactive proxy）
    let viewRound = beginRound()

    // 循环守卫 / 无进展状态（每轮重置前保留跨轮计数）
    const failureFingerprints = new Map() // `${toolName}|${JSON.stringify(args)}` → 连续失败次数
    let stalledRounds = 0

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const { aborted, toolCalls } = await runCompletion(viewRound, model)
        if (aborted || cancelFlag) break
        // 以完整结果为准（覆盖流式期间的部分工具调用）
        viewRound.tool_calls = toolCalls.map(toOpenAiToolCall)
        if (toolCalls.length === 0) {
          // 每轮对话结束前：对当前工作流做运行检查（同步快速检测，缺节点/未连接/必填输入/子流程/参数引用），
          // 发现问题注入提示让模型先修复再输出最终回复（受 MAX_TOOL_ROUNDS 上限保护）
          const { ok, errors } = quickValidateWorkflow(flowStore)
          if (!ok && round < MAX_TOOL_ROUNDS - 1) {
            const checkMsg = {
              message_id: uuidv4(),
              round_id: roundId,
              role: 'user',
              content: `【工作流运行检查未通过】请先修复以下问题再输出最终回复：\n${errors
                .map((e) => `- ${e.message}`)
                .join('\n')}`
            }
            contextMessages.push(checkMsg)
            await persistIn(checkMsg)
            viewRound = beginRound(viewRound)
            continue
          }
          // 最终轮：无工具调用，本消息即最终回答
          viewRound.loading = false
          break
        }
        viewRound.loading = false
        viewRound.tool_calling = 'loading'
        // 执行工具，结果写入上下文并持久化；finish 表示模型已达目标，执行后结束本轮
        const { finished, loopGuardBreak, roundFailed } = await executeToolCalls({
          toolCalls,
          roundId,
          executors,
          persistIn,
          contextMessages,
          messages,
          failureFingerprints
        })
        // 工具执行完毕：结束"调用中"状态（否则中间工具轮消息的 tool_calling 残留 'loading'，
        // 历史消息会永久显示"调用工具中..."转圈卡；所有后续分支均经过此复位点）
        viewRound.tool_calling = ''
        if (finished || loopGuardBreak) {
          // 守卫触发后放行一轮：让模型基于提示输出阶段性结论，避免空回复气泡
          if (loopGuardBreak) {
            viewRound = beginRound(viewRound)
            const guardFinal = await runCompletion(viewRound, model)
            if (guardFinal.aborted || cancelFlag) break
            viewRound.tool_calls = (guardFinal.toolCalls || []).map(toOpenAiToolCall)
            viewRound.loading = false
          }
          break
        }
        // 无进展检测：连续失败轮数达到阈值 → 提示输出结论并放行一轮
        stalledRounds = roundFailed ? stalledRounds + 1 : 0
        if (stalledRounds >= STALL_ROUNDS) {
          const stallMsg = {
            message_id: uuidv4(),
            round_id: roundId,
            role: 'user',
            content: STALL_PROMPT_MSG
          }
          contextMessages.push(stallMsg)
          await persistIn(stallMsg)
          viewRound = beginRound(viewRound)
          const stallFinal = await runCompletion(viewRound, model)
          if (stallFinal.aborted || cancelFlag) break
          viewRound.tool_calls = (stallFinal.toolCalls || []).map(toOpenAiToolCall)
          viewRound.loading = false
          break
        }
        // 触顶 grace round：最后一轮仍有工具调用 → 注入提示，放行一轮最终回答
        if (round === MAX_TOOL_ROUNDS - 1) {
          const graceMsg = {
            message_id: uuidv4(),
            round_id: roundId,
            role: 'user',
            content: GRACE_PROMPT_MSG
          }
          contextMessages.push(graceMsg)
          await persistIn(graceMsg)
          viewRound = beginRound(viewRound)
          const final = await runCompletion(viewRound, model)
          if (final.aborted || cancelFlag) break
          viewRound.tool_calls = (final.toolCalls || []).map(toOpenAiToolCall)
          viewRound.loading = false
          break // 无论是否还有工具调用都结束工具阶段
        }
        // 下一轮：新 assistant 消息（切换前已持久化当前轮完整状态）
        viewRound = beginRound(viewRound)
      }
      if (viewRound) {
        viewRound.loading = false
        viewRound.tool_calling = ''
        if (cancelFlag) viewRound.content = viewRound.content || '（已取消）'
        await persistIn(viewRound)
      }
      // 会话列表刷新（标题/时间更新）
      await refreshConversations()
    } catch (error) {
      console.error('调用AI模型失败:', error)
      // 失败时清空 tool_calls 再持久化：残缺调用（无配对 tool 结果）残留进历史会让
      // 后续每次交互都在 AI SDK 本地校验处失败（MissingToolResultsError），表现为"永远输出同一错误"
      if (viewRound) {
        viewRound.tool_calls = []
        viewRound.content = friendlyAIError(error)
        viewRound.loading = false
        viewRound.tool_calling = ''
        await persistIn(viewRound)
      }
    } finally {
      loading.value = false
      chatStream = null
    }
  }

  return {
    messages: displayMessages,
    allMessages: messages,
    conversations,
    currentConversationId,
    loading,
    init,
    newConversation,
    switchConversation,
    removeConversation,
    send,
    cancel,
    removeMessage
  }
}
