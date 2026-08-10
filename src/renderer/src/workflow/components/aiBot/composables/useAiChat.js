/**
 * @file: AI 会话状态机（多会话）
 * 职责：会话列表 / 新建会话 / 切换会话 / 消息列表 / 流式增量拼接 / 工具调用循环 / 取消 / 删除
 * 会话模型：ai_conversations（id, workflow_id, title）；消息按 conversation_id 隔离
 * 消息模型（与 sqlite 表一致，OpenAI 风格 tool_calls）：
 *   user:      { message_id, role, content, attachments? }
 *   assistant: { message_id, role, content, reasoning_content, tool_calls: [{id,type,function:{name,arguments}}] }
 *   tool:      { message_id, role, tool_call_id, tool_name, content }（仅入上下文与持久化，UI 不渲染气泡）
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

const MAX_TOOL_ROUNDS = 8 // 工具循环轮次上限，防止模型死循环
const MAX_LOOP_GUARD_FAILURES = 2 // 同一工具同一参数连续失败次数 → 阻断循环
const STALL_ROUNDS = 4 // 连续无进展轮数 → 提示输出结论
const LOOP_GUARD_MSG =
  'blocked: [loop guard] 同一工具调用已连续失败，请停止重试并修正参数或改用其他方式，然后直接输出阶段性结论或询问用户'
const BUDGET_CHARS = 240000 // 提交上下文总字符预算
const MAX_TOOL_RESULT = 20000 // 单条 tool 结果截断上限

/** 上下文预算：总长超限时先截断超长 tool 结果（head），仍超则丢弃最早的 tool 结果（不丢 sqlite 原文） */
const snipContext = (ctx) => {
  const estimate = (m) => JSON.stringify(m).length
  let total = 0
  for (const m of ctx) total += estimate(m)
  if (total <= BUDGET_CHARS) return ctx
  let result = ctx.map((m) => {
    if (m.role !== 'tool') return m
    const text = String(m.content || '')
    if (text.length <= MAX_TOOL_RESULT) return m
    return { ...m, content: `${text.slice(0, MAX_TOOL_RESULT)}…[truncated]` }
  })
  while (true) {
    total = 0
    for (const m of result) total += estimate(m)
    if (total <= BUDGET_CHARS) break
    const idx = result.findIndex((m) => m.role === 'tool')
    if (idx === -1) break
    result = [...result.slice(0, idx), ...result.slice(idx + 1)]
  }
  return result
}

/**
 * 清洗提交给模型的上下文，自愈残缺工具调用配对：
 * - assistant 的 tool_calls 若 id/function.name 缺失或其后无对应 tool 结果 → 剔除该调用
 *   （AI SDK 校验这些字段，undefined 会抛 AI_InvalidPromptError 拒绝发送请求，
 *   导致"一旦失败永远失败"）
 * - tool 消息若无有效对应 assistant tool_call → 剔除孤儿结果
 */
const sanitizeContext = (ctx) => {
  // 有效 tool_call：id 与 function.name 均非空才计入
  const validIds = new Set()
  ctx.forEach((m) => {
    if (m.role === 'assistant') {
      ;(m.tool_calls || []).forEach((tc) => {
        if (tc?.id && tc.function?.name) validIds.add(tc.id)
      })
    }
  })
  const cleaned = ctx.map((m, i) => {
    if (m.role === 'tool') {
      return m.tool_call_id && validIds.has(m.tool_call_id) ? m : null
    }
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const laterToolIds = new Set(
        ctx.slice(i + 1).filter((x) => x.role === 'tool' && x.tool_call_id).map((x) => x.tool_call_id)
      )
      const kept = m.tool_calls.filter((tc) => tc?.id && tc.function?.name && laterToolIds.has(tc.id))
      if (kept.length !== m.tool_calls.length) return { ...m, tool_calls: kept }
    }
    return m
  })
  return cleaned.filter(Boolean)
}

/** 把 AI 调用错误转成用户可读的提示（区分认证/网络/模型等常见原因） */
const friendlyAIError = (error) => {
  const msg = String(error?.message || error || '')
  if (!msg || msg === 'Error') return '调用失败：模型响应异常，请重试'
  if (/401|403|unauthori|invalid api|apikey|api key|authentication|permission/i.test(msg)) {
    return '调用失败：API KEY 无效或已过期，请在「设置 → 模型管理」中检查供应商配置'
  }
  if (/404/.test(msg) && /model|not found/i.test(msg)) {
    return '调用失败：模型不存在，请在「设置 → 模型管理」中确认模型 ID'
  }
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|network error|socket/i.test(msg)) {
    return '调用失败：无法连接 AI 供应商，请检查网络与 API 地址'
  }
  if (/429|rate limit|too many requests/i.test(msg)) {
    return '调用失败：请求过于频繁（限流），请稍后重试'
  }
  if (/400|422|schema|validation|invalid/i.test(msg)) {
    return `调用失败：请求参数异常（${msg.slice(0, 120)}）`
  }
  return `调用失败：${msg.slice(0, 200)}`
}

const toOpenAiToolCall = (tc) => ({
  id: tc.toolCallId,
  type: 'function',
  function: { name: tc.toolName, arguments: tc.args || {} }
})

export const useAiChat = ({ workflowId, tools, executors, buildSystem, buildTurn, scrollToBottom }) => {
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
      messages.value = (await getChatMessages(workflowId, conversationId)) || []
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
    await persistIn(userMsg)

    // 每轮补全独立一条 assistant 消息（推理/工具调用/文本属于同一时间单元）。
    // 此前多轮工具调用聚合到同一条消息，UI 上所有推理堆在一起、时间错位，用户阅读困难；
    // 拆分后每条 assistant 消息 = 一轮（工具轮显示推理+工具卡片，最终轮显示推理+文本），时间顺序清晰
    const beginRound = () => {
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

    // 循环守卫 / 无进展 / grace 状态（每轮重置前保留跨轮计数）
    const failureFingerprints = new Map() // `${toolName}|${JSON.stringify(args)}` → 连续失败次数
    let stalledRounds = 0
    let loopGuardBreak = false

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const { aborted, toolCalls } = await runCompletion(viewRound, model)
        if (aborted || cancelFlag) break
        // 以完整结果为准（覆盖流式期间的部分工具调用）
        viewRound.tool_calls = toolCalls.map(toOpenAiToolCall)
        if (toolCalls.length === 0) {
          // 最终轮：无工具调用，本消息即最终回答
          viewRound.loading = false
          break
        }
        viewRound.loading = false
        viewRound.tool_calling = 'loading'
        // 执行工具，结果写入上下文并持久化；finish 表示模型已达目标，执行后结束本轮
        let finished = false
        let roundFailed = false
        for (const tc of toolCalls) {
          if (tc.toolName === 'finish') {
            finished = true
            break
          }
          let output
          let durationMs = 0
          try {
            const handler = executors[tc.toolName]
            if (!handler) throw new Error(`未知工具: ${tc.toolName}`)
            const t0 = performance.now()
            output = await handler(tc.args || {})
            durationMs = Math.round(performance.now() - t0)
          } catch (error) {
            // 统一为结构化失败结果（与执行器返回的 {ok:false} 一致），供模型自纠；
            // 同时打印完整堆栈到 Console——工具失败常被这里吞掉，保留堆栈才能定位根因
            console.error(`[AIBot 工具执行失败] ${tc.toolName}`, tc.args, error)
            output = {
              ok: false,
              error: `${error?.message || String(error)}\n  ↳ ${(error?.stack || '').split('\n').slice(1, 4).join('\n  ↳ ')}`
            }
          }
          const isFail = output && (output.ok === false || (typeof output === 'string' && output.startsWith('error')))
          // 循环守卫：同一工具同一参数连续失败达到上限 → 注入 blocked 并结束工具阶段
          if (isFail) {
            roundFailed = true
            const fingerprint = `${tc.toolName}|${JSON.stringify(tc.args || {})}`
            const count = (failureFingerprints.get(fingerprint) || 0) + 1
            failureFingerprints.set(fingerprint, count)
            if (count >= MAX_LOOP_GUARD_FAILURES) {
              const guardMsg = {
                message_id: uuidv4(),
                round_id: roundId,
                role: 'tool',
                tool_call_id: tc.toolCallId,
                tool_name: tc.toolName,
                content: LOOP_GUARD_MSG
              }
              contextMessages.push(guardMsg)
              await persistIn(guardMsg)
              loopGuardBreak = true
              break
            }
          }
          const toolMsg = {
            message_id: uuidv4(),
            round_id: roundId,
            role: 'tool',
            tool_call_id: tc.toolCallId,
            tool_name: tc.toolName,
            content: typeof output === 'string' ? output : JSON.stringify(output),
            duration_ms: durationMs
          }
          contextMessages.push(toolMsg)
          // 同步进 UI 消息源（displayMessages 过滤 tool，不显示为独立消息；供 buildRoundGroups 合并卡片结果与耗时）
          messages.value.push(toolMsg)
          await persistIn(toolMsg)
        }
        if (finished || loopGuardBreak) {
          // 守卫触发后放行一轮：让模型基于提示输出阶段性结论，避免空回复气泡
          if (loopGuardBreak) {
            viewRound = beginRound()
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
            content: '提示：已连续多轮没有进展，请基于已有信息输出阶段性结论，或向用户询问下一步操作。'
          }
          contextMessages.push(stallMsg)
          await persistIn(stallMsg)
          viewRound = beginRound()
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
            content: '提示：已达到工具调用轮次上限。请基于已完成的工具结果直接输出最终回复，不要再调用工具。'
          }
          contextMessages.push(graceMsg)
          await persistIn(graceMsg)
          viewRound = beginRound()
          const final = await runCompletion(viewRound, model)
          if (final.aborted || cancelFlag) break
          viewRound.tool_calls = (final.toolCalls || []).map(toOpenAiToolCall)
          viewRound.loading = false
          break // 无论是否还有工具调用都结束工具阶段
        }
        // 下一轮：新 assistant 消息
        viewRound = beginRound()
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
