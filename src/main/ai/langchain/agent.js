/**
 * @file: LangGraph Agent 循环（主进程）
 * 一个 turn = 多个 step：
 *   prepare（提示组装/轮次与上限判定）→ model（流式补全）→ tools（回桥渲染层执行）
 *   → check（工作流校验/修复）→ step/end → 下一 step / 结束
 * 事件由主进程统一产出；工具执行仍由渲染层（依赖画布状态）通过 host 回调完成。
 */
import { randomUUID } from 'node:crypto'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages'
import { AI_EVENT } from '../../../shared/ai-events.js'
import { friendlyAIError } from '../../../shared/ai-error.js'
import { closeTruncatedJSON } from '../messageNormalizer.js'
import { createChatModel, isThinkingModel } from './models.js'
import { buildSystemMessage, toLangChainMessages, toLangChainTools } from './messages.js'

export const MAX_TOOL_ROUNDS = 128 // turn 内 step 上限
export const STALL_ROUNDS = 3 // 连续失败/无进展轮数上限
export const STALL_PROMPT_MSG =
  '提示：已连续 3 轮工具调用失败/无进展，请停止重试，基于已有信息输出阶段性结论，或向用户询问下一步操作，不要再调用工具。'
export const GRACE_PROMPT_MSG =
  '提示：已达到工具调用轮次上限。请基于已完成的工具结果直接输出最终回复，不要再调用工具。'

const abortError = () => {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

const isAbortError = (error, signal) =>
  error?.name === 'AbortError' || !!signal?.aborted || /abort/i.test(String(error?.message || ''))

const parseArgs = (raw) => {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  try {
    return JSON.parse(raw)
  } catch {
    const fixed = closeTruncatedJSON(raw)
    if (fixed != null) {
      try {
        return JSON.parse(fixed)
      } catch {
        return {}
      }
    }
    return {}
  }
}

/** 单次模型尝试的流式累积器 */
const createAttempt = () => {
  const messageId = randomUUID()
  let text = ''
  let reasoning = ''
  const calls = new Map()
  return {
    messageId,
    get text() {
      return text
    },
    get reasoning() {
      return reasoning
    },
    get calls() {
      return calls
    },
    pushText(delta) {
      text += delta
    },
    pushReasoning(delta) {
      reasoning += delta
    },
    hasVisible() {
      return !!text || !!reasoning || calls.size > 0
    },
    blocks() {
      const blocks = []
      if (reasoning) blocks.push({ type: 'reasoning', text: reasoning })
      if (text) blocks.push({ type: 'text', text })
      for (const call of calls.values()) {
        blocks.push({
          type: 'tool-call',
          callId: call.callId,
          name: call.name,
          arguments: parseArgs(call.raw)
        })
      }
      return blocks
    }
  }
}

const mapUsage = (aggregated) => {
  const usage = aggregated?.usage_metadata
  const raw = aggregated?.response_metadata?.usage || null
  if (!usage && !raw) return null
  const inputTokens = usage?.input_tokens ?? raw?.prompt_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? raw?.completion_tokens ?? 0
  const totalTokens = usage?.total_tokens ?? raw?.total_tokens ?? inputTokens + outputTokens
  const cacheReadTokens =
    usage?.input_token_details?.cache_read ?? raw?.prompt_tokens_details?.cached_tokens ?? 0
  const result = { inputTokens, outputTokens, totalTokens }
  if (usage?.input_token_details) {
    result.inputTokenDetails = {
      cacheReadTokens,
      noCacheTokens: Math.max(0, inputTokens - cacheReadTokens)
    }
  } else if (raw?.prompt_tokens_details) {
    result.inputTokenDetails = {
      cacheReadTokens,
      noCacheTokens: Math.max(0, inputTokens - cacheReadTokens)
    }
  }
  if (usage?.output_token_details?.reasoning != null) {
    result.outputTokenDetails = { reasoningTokens: usage.output_token_details.reasoning }
  }
  if (raw) result.raw = raw
  return result
}

const finishReasonOf = (aggregated) =>
  aggregated?.response_metadata?.finish_reason ||
  aggregated?.response_metadata?.stop_reason ||
  aggregated?.response_metadata?.finishReason ||
  ''

const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (current, update) => current.concat(update),
    default: () => []
  }),
  step: Annotation({ reducer: (_current, update) => update, default: () => 0 }),
  forceFinal: Annotation({ reducer: (_current, update) => update, default: () => false }),
  finalPrompted: Annotation({ reducer: (_current, update) => update, default: () => false }),
  stalledRounds: Annotation({ reducer: (_current, update) => update, default: () => 0 }),
  pendingCalls: Annotation({ reducer: (_current, update) => update, default: () => [] }),
  pendingInject: Annotation({ reducer: (_current, update) => update, default: () => '' }),
  runtimeContext: Annotation({ reducer: (_current, update) => update, default: () => '' }),
  system: Annotation({ reducer: (_current, update) => update, default: () => '' }),
  stepKind: Annotation({ reducer: (_current, update) => update, default: () => 'completed' }),
  done: Annotation({ reducer: (_current, update) => update, default: () => false })
})

/**
 * 执行一个 turn
 * @param {Object} options
 * @param {Object} options.provider 含明文 apiKey 的供应商
 * @param {string} options.modelId
 * @param {number} options.turn
 * @param {string} options.turnId
 * @param {Array} options.messages renderer 内部格式历史消息（不含 runtime-context）
 * @param {Array} options.tools OpenAI 风格工具定义
 * @param {AbortSignal} options.signal
 * @param {(method:string, payload:Object)=>Promise<any>} options.host 渲染层桥接
 * @param {(type:string, data:Object, meta:{turn:number, step:number})=>void} options.onEvent
 * @param {(part:Object)=>void} options.onPart
 * @returns {Promise<{outcome:{kind:string, error?:string}}>}
 */
export const runAgentTurn = async ({
  provider,
  modelId,
  turn,
  turnId,
  messages = [],
  tools = [],
  signal,
  host,
  onEvent,
  onPart
}) => {
  const thinking = isThinkingModel(modelId)
  const baseMessages = toLangChainMessages(messages, { thinking })
  const toolDefs = toLangChainTools(tools)
  const model = createChatModel(provider, modelId)
  const boundModel = toolDefs.length ? model.bindTools(toolDefs) : model
  const ctx = { attempt: null, toolIndexToId: new Map() }

  const emit = (type, data, step) => onEvent?.(type, data, { turn, step })
  // 增量帧统一附带 attemptId，便于渲染层把 chunk 归到当前 attempt
  const emitPart = (part) => {
    if (!ctx.attempt || part.type === 'attempt-start' || part.type === 'attempt-end') {
      return onPart?.(part)
    }
    return onPart?.({ attemptId: ctx.attempt.messageId, ...part })
  }
  const hostCall = (method, payload, step) =>
    host(method, { ...payload, turn, step, roundId: turnId })

  /** 组装本步提示并注入待处理提示 */
  const prepare = async (state) => {
    let forceFinal = state.forceFinal
    let finalPrompted = state.finalPrompted
    let pendingInject = state.pendingInject
    // 达到 step 上限：先注入一次"收尾"提示并强制最后一步不再执行工具
    if (state.step >= MAX_TOOL_ROUNDS) {
      if (finalPrompted) return { done: true }
      finalPrompted = true
      forceFinal = true
      pendingInject = GRACE_PROMPT_MSG
    }

    const step = state.step + 1
    ctx.lastStep = step
    ctx.stepHasAssistant = false
    emit(AI_EVENT.STEP_START, { turn, step }, step)

    if (pendingInject) {
      const message = {
        message_id: randomUUID(),
        round_id: turnId,
        role: 'user',
        source: 'agent-inject',
        content: pendingInject
      }
      emit(AI_EVENT.USER_MESSAGE, { turn, step, source: 'agent-inject', message }, step)
    }

    const { system = '', runtimeContext = '', systemChanged = false } = await hostCall(
      'assemblePrompt',
      {},
      step
    )
    if (systemChanged && system) {
      emit(AI_EVENT.SYSTEM_MESSAGE, { turn, step, system }, step)
    }
    if (runtimeContext) {
      emit(
        AI_EVENT.USER_MESSAGE,
        {
          turn,
          step,
          source: 'runtime-context',
          message: {
            message_id: randomUUID(),
            round_id: turnId,
            role: 'user',
            content: runtimeContext,
            source: 'runtime-context'
          }
        },
        step
      )
    }

    return {
      step,
      system,
      runtimeContext,
      forceFinal,
      finalPrompted,
      pendingInject: '',
      stepKind: 'completed',
      done: false,
      messages: pendingInject
        ? [
            new HumanMessage({
              content: pendingInject,
              additional_kwargs: { source: 'agent-inject' }
            })
          ]
        : []
    }
  }

  /** 调模型（LangChain stream）→ 事件 + 流式帧 */
  const modelNode = async (state) => {
    const step = state.step
    const attempt = createAttempt()
    ctx.attempt = attempt
    ctx.toolIndexToId = new Map()

    emitPart({
      type: 'attempt-start',
      attemptId: attempt.messageId,
      turnId,
      turn,
      step
    })

    const requestMessages = [buildSystemMessage(state.system), ...state.messages]
    if (state.runtimeContext) {
      requestMessages.push(
        new HumanMessage({
          content: state.runtimeContext,
          additional_kwargs: { source: 'runtime-context' }
        })
      )
    }

    let aggregated
    const startedCalls = new Set()
    try {
      const stream = await boundModel.stream(requestMessages, { signal })
      for await (const chunk of stream) {
        if (signal?.aborted) throw abortError()
        aggregated = aggregated ? aggregated.concat(chunk) : chunk

        const textDelta = chunk.text || ''
        if (textDelta) {
          attempt.pushText(textDelta)
          emitPart({ type: 'text', text: textDelta })
        }

        const reasoningDelta =
          chunk.additional_kwargs?.reasoning_content ||
          (Array.isArray(chunk.content)
            ? chunk.content
                .filter((block) => block?.type === 'thinking' || block?.type === 'reasoning')
                .map((block) => block.thinking || block.text || '')
                .join('')
            : '')
        if (reasoningDelta) {
          attempt.pushReasoning(reasoningDelta)
          emitPart({ type: 'reasoning', text: reasoningDelta })
        }

        for (const toolChunk of chunk.tool_call_chunks || []) {
          const index = toolChunk.index ?? 0
          if (toolChunk.id) ctx.toolIndexToId.set(index, toolChunk.id)
          const callId = toolChunk.id || ctx.toolIndexToId.get(index)
          if (!callId) continue
          let call = attempt.calls.get(callId)
          if (!call) {
            call = { callId, name: '', raw: '' }
            attempt.calls.set(callId, call)
          }
          if (toolChunk.name) call.name = toolChunk.name
          if (!startedCalls.has(callId) && call.name) {
            startedCalls.add(callId)
            emitPart({ type: 'tool-call', toolCallId: callId, toolName: call.name, args: {} })
          }
          const argDelta = typeof toolChunk.args === 'string' ? toolChunk.args : ''
          if (argDelta) {
            call.raw += argDelta
            emitPart({ type: 'tool-arg', toolCallId: callId, arg: argDelta })
          }
        }
      }
    } catch (error) {
      emitPart({ type: 'attempt-end', attemptId: attempt.messageId, error: true })
      throw error
    }

    if (signal?.aborted) throw abortError()

    // 完整结果兜底：个别 provider 只给最终值
    if (!attempt.text && aggregated?.text) {
      attempt.pushText(aggregated.text)
      emitPart({ type: 'text', text: aggregated.text })
    }
    if (!attempt.reasoning && aggregated?.additional_kwargs?.reasoning_content) {
      const reasoning = aggregated.additional_kwargs.reasoning_content
      attempt.pushReasoning(reasoning)
      emitPart({ type: 'reasoning', text: reasoning })
    }

    const finalCalls = (aggregated?.tool_calls || [])
      .map((call) => ({
        callId: call.id || randomUUID(),
        name: call.name || '',
        args: call.args ?? {}
      }))
      .filter((call) => call.name)
    // 增量流没有产出最终 tool_calls 时，用累积的原始参数解析兜底
    const calls =
      finalCalls.length > 0
        ? finalCalls
        : [...attempt.calls.values()]
            .filter((call) => call.name)
            .map((call) => ({ callId: call.callId, name: call.name, args: parseArgs(call.raw) }))

    const blocks = attempt
      .blocks()
      .filter((block) => block.type !== 'tool-call')
      .concat(
        calls.map((call) => ({
          type: 'tool-call',
          callId: call.callId,
          name: call.name,
          arguments: call.args
        }))
      )

    emit(
      AI_EVENT.ASSISTANT_MESSAGE,
      {
        turn,
        step,
        usage: mapUsage(aggregated),
        finishReason: finishReasonOf(aggregated),
        message: {
          message_id: attempt.messageId,
          round_id: turnId,
          role: 'assistant',
          content: blocks
        }
      },
      step
    )
    emitPart({ type: 'attempt-end', attemptId: attempt.messageId })
    ctx.attempt = null
    ctx.stepHasAssistant = true

    const aiMessage = new AIMessage({
      content: attempt.text,
      tool_calls: calls.map((call) => ({
        id: call.callId,
        name: call.name,
        args: call.args,
        type: 'tool_call'
      })),
      additional_kwargs: attempt.reasoning ? { reasoning_content: attempt.reasoning } : {}
    })

    return {
      messages: [aiMessage],
      pendingCalls: calls,
      stepKind: 'completed',
      done: !!state.forceFinal
    }
  }

  /** 工具阶段：交付渲染层执行（事件由渲染层工具管线产出） */
  const toolsNode = async (state) => {
    const step = state.step
    const execution = await hostCall(
      'runTools',
      {
        calls: state.pendingCalls.map((call) => ({
          callId: call.callId,
          name: call.name,
          arguments: call.args || {}
        }))
      },
      step
    )

    const results = execution?.results || []
    // 逐条构造 ToolMessage（与 assistant tool_calls 一一配对）
    const pairedMessages = results
      .filter((result) => result?.callId)
      .map(
        (result) =>
          new ToolMessage({
            content: String(result.content ?? ''),
            tool_call_id: result.callId,
            name: result.name || ''
          })
      )

    let forceFinal = state.forceFinal
    let stalledRounds = state.stalledRounds
    let pendingInject = ''
    let done = false
    let stepKind = 'tools'

    if (execution?.concluded) {
      done = true
      stepKind = 'concluded'
    } else {
      stalledRounds = execution?.roundFailed ? stalledRounds + 1 : 0
      if (execution?.loopGuardBreak) {
        forceFinal = true
      } else if (stalledRounds >= STALL_ROUNDS) {
        forceFinal = true
        pendingInject = STALL_PROMPT_MSG
      }
    }

    return {
      messages: pairedMessages,
      pendingCalls: [],
      forceFinal,
      stalledRounds,
      pendingInject,
      done,
      stepKind
    }
  }

  /** 无工具调用的答复：工作流校验（未通过则注入修复指令继续） */
  const checkNode = async (state) => {
    const step = state.step
    const check = await hostCall('workflowCheck', {}, step)
    const errors = Array.isArray(check?.errors) ? check.errors : []
    if (errors.length > 0 && check?.canFix && check?.repairMessage) {
      return {
        pendingInject: check.repairMessage,
        done: false,
        stepKind: 'completed'
      }
    }
    return { done: true, stepKind: 'completed' }
  }

  /** 统一产出 step/end，并按 done 决定是否结束 */
  const stepEndNode = async (state) => {
    emit(
      AI_EVENT.STEP_END,
      { turn, step: state.step, reason: { kind: state.stepKind } },
      state.step
    )
    return {}
  }

  const graph = new StateGraph(AgentState)
    .addNode('prepare', prepare)
    .addNode('model', modelNode)
    .addNode('tools', toolsNode)
    .addNode('check', checkNode)
    .addNode('stepEnd', stepEndNode)
    .addEdge(START, 'prepare')
    .addConditionalEdges('prepare', (state) => (state.done ? END : 'model'), {
      model: 'model',
      [END]: END
    })
    .addConditionalEdges(
      'model',
      (state) => {
        if (state.done) return 'stepEnd'
        if (state.pendingCalls.length > 0) return 'tools'
        return 'check'
      },
      { stepEnd: 'stepEnd', tools: 'tools', check: 'check' }
    )
    .addEdge('tools', 'stepEnd')
    .addEdge('check', 'stepEnd')
    .addConditionalEdges('stepEnd', (state) => (state.done ? END : 'prepare'), {
      prepare: 'prepare',
      [END]: END
    })
    .compile()

  try {
    await graph.invoke(
      {
        messages: baseMessages,
        step: 0,
        forceFinal: false,
        finalPrompted: false,
        stalledRounds: 0,
        pendingCalls: [],
        pendingInject: '',
        runtimeContext: '',
        system: '',
        stepKind: 'completed',
        done: false
      },
      { recursionLimit: 2000, signal }
    )
    return { outcome: { kind: 'completed' } }
  } catch (error) {
    const attempt = ctx.attempt
    if (isAbortError(error, signal)) {
      if (ctx.stepHasAssistant) {
        if (attempt) emitPart({ type: 'attempt-end', attemptId: attempt.messageId, aborted: true })
        ctx.attempt = null
        return { outcome: { kind: 'aborted' } }
      }
      if (attempt?.hasVisible()) {
        emit(
          AI_EVENT.ASSISTANT_MESSAGE,
          {
            turn,
            step: ctx.lastStep || 0,
            interrupted: true,
            message: {
              message_id: attempt.messageId,
              round_id: turnId,
              role: 'assistant',
              content: attempt.blocks()
            }
          },
          ctx.lastStep || 0
        )
      } else {
        emit(
          AI_EVENT.ASSISTANT_ATTEMPT,
          {
            turn,
            step: Math.max(ctx.lastStep || 0, 1),
            message: {
              message_id: attempt?.messageId || randomUUID(),
              round_id: turnId,
              role: 'assistant',
              content: attempt?.blocks() || []
            },
            error: '已取消'
          },
          Math.max(ctx.lastStep || 0, 1)
        )
      }
      if (attempt) emitPart({ type: 'attempt-end', attemptId: attempt.messageId, aborted: true })
      ctx.attempt = null
      return { outcome: { kind: 'aborted' } }
    }

    if (attempt) {
      emit(
        AI_EVENT.ASSISTANT_ATTEMPT,
        {
          turn,
          step: ctx.lastStep || 1,
          message: {
            message_id: attempt.messageId,
            round_id: turnId,
            role: 'assistant',
            content: attempt.blocks()
          },
          error: friendlyAIError(error)
        },
        ctx.lastStep || 1
      )
      emitPart({ type: 'attempt-end', attemptId: attempt.messageId, error: true })
      ctx.attempt = null
    }
    console.error('AI turn 执行失败:', error)
    return { outcome: { kind: 'error', error: friendlyAIError(error) } }
  }
}
