/**
 * @file: AI 内核 - Agent driver（turn / step）
 * 对齐 dsh core/agent-loop：
 *   turn/start → claim inbox → 组装提示 → step/start → 请求模型（assistant-stream 瞬时帧）
 *   → assistant/message | assistant/attempt → tool/call* → 工具管线 → tool/result*
 *   → step/end → （工具待继续 / 校验修复）→ 下一 step → turn/end
 * 事件是唯一事实来源；实时帧只走 onFrame，不落库。
 */
import { v4 as uuidv4 } from 'uuid'
import { AI_EVENT, toPlain } from './events.js'
import { prepareRequestMessages, friendlyAIError } from './policies/contextBudget'
import {
  MAX_TOOL_ROUNDS,
  STALL_ROUNDS,
  STALL_PROMPT_MSG,
  GRACE_PROMPT_MSG,
  createLoopGuard
} from './policies/loopGuard'

const abortError = () => {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

const isAbort = (error, signal) => error?.name === 'AbortError' || !!signal?.aborted

// source:agent-inject 的提示只进模型历史，不作为用户气泡展示（与旧实现"仅注入上下文"一致）
const userMessage = (content, roundId) => ({
  message_id: uuidv4(),
  round_id: roundId,
  role: 'user',
  source: 'agent-inject',
  content
})

/** 单次尝试的流式累积器（text/reasoning/tool-call） */
const createAttempt = () => {
  const messageId = uuidv4()
  let text = ''
  let reasoning = ''
  const toolCalls = new Map()
  return {
    messageId,
    push(chunk) {
      if (chunk.type === 'text-delta') text += chunk.text || ''
      else if (chunk.type === 'reasoning-delta') reasoning += chunk.text || ''
      else if (chunk.type === 'tool-call') {
        toolCalls.set(chunk.callId, { callId: chunk.callId, name: chunk.name || '', input: chunk.input ?? {} })
      } else if (chunk.type === 'tool-call-delta') {
        const current = toolCalls.get(chunk.callId)
        if (current) current.raw = (current.raw || '') + (chunk.delta || '')
        else toolCalls.set(chunk.callId, { callId: chunk.callId, name: '', input: {}, raw: chunk.delta || '' })
      }
    },
    get text() {
      return text
    },
    get reasoning() {
      return reasoning
    },
    get toolCalls() {
      return [...toolCalls.values()]
    },
    hasVisible() {
      return !!text || !!reasoning || toolCalls.size > 0
    },
    blocks() {
      const blocks = []
      if (reasoning) blocks.push({ type: 'reasoning', text: reasoning })
      if (text) blocks.push({ type: 'text', text })
      for (const call of toolCalls.values()) {
        blocks.push({
          type: 'tool-call',
          callId: call.callId,
          name: call.name,
          arguments: call.input ?? {}
        })
      }
      return blocks
    }
  }
}

/**
 * @param {Object} options
 * @param {Object} options.session
 * @param {Object} options.inbox
 * @param {Object} options.llm
 * @param {Object} options.registry
 * @param {Object} options.prompt
 * @param {Object} options.toolsPipeline
 * @param {Object} options.workflowGuard
 * @param {Function} options.getModel () => { providerId, modelId }
 * @param {Function} [options.onStatus]
 * @param {Function} [options.onFrame]
 */
export const createAgent = ({
  session,
  inbox,
  llm,
  registry,
  prompt,
  toolsPipeline,
  workflowGuard,
  getModel,
  onStatus,
  onFrame
} = {}) => {
  let running = false
  let controller = null
  let status = 'idle'

  const setStatus = (next) => {
    status = next
    onStatus?.(next)
  }

  const appendAttempt = (meta, attempt, errorText) => {
    session.append(
      AI_EVENT.ASSISTANT_ATTEMPT,
      {
        turn: meta.turn,
        step: meta.step,
        message: {
          message_id: attempt.messageId,
          round_id: meta.roundId,
          role: 'assistant',
          content: attempt.blocks()
        },
        error: errorText
      },
      { turn: meta.turn, step: meta.step }
    )
  }

  /** 执行一个 step：请求模型 → 记录 assistant 结果 → （可选）执行工具 */
  const runStep = async ({ turn, turnId, step, claimed, model, guard, forceFinal }) => {
    const meta = { turn, step, roundId: turnId }
    const toolSet = registry.resolve()
    const { system, runtimeContext, systemChanged } = prompt.assemble()
    if (systemChanged && system) {
      session.append(AI_EVENT.SYSTEM_MESSAGE, { turn, step, system }, meta)
    }
    for (const message of claimed) {
      session.append(
        AI_EVENT.USER_MESSAGE,
        {
          turn,
          step,
          source: message.source || 'user',
          message: {
            message_id: message.message_id || uuidv4(),
            round_id: message.round_id || turnId,
            role: 'user',
            content: message.content || '',
            attachments: message.attachments,
            source: message.source
          }
        },
        meta
      )
    }
    if (runtimeContext) {
      session.append(
        AI_EVENT.USER_MESSAGE,
        {
          turn,
          step,
          source: 'runtime-context',
          message: {
            message_id: uuidv4(),
            round_id: turnId,
            role: 'user',
            content: runtimeContext,
            source: 'runtime-context'
          }
        },
        meta
      )
    }

    const history = prepareRequestMessages(session.deriveModel(), model)
    const attempt = createAttempt()
    onFrame?.({ kind: 'start', attemptId: attempt.messageId, turnId, turn, step })

    let result
    try {
      result = await llm.stream(
        {
          providerId: model.providerId,
          modelId: model.modelId,
          messages: toPlain(history),
          tools: toolSet.tools,
          system
        },
        controller?.signal,
        (chunk) => {
          attempt.push(chunk)
          onFrame?.({ kind: 'chunk', attemptId: attempt.messageId, turnId, turn, step, chunk })
        }
      )
    } catch (error) {
      if (isAbort(error, controller?.signal)) {
        if (attempt.hasVisible()) {
          session.append(
            AI_EVENT.ASSISTANT_MESSAGE,
            { turn, step, interrupted: true, message: { message_id: attempt.messageId, round_id: turnId, role: 'assistant', content: attempt.blocks() } },
            meta
          )
        } else {
          appendAttempt(meta, attempt, '已取消')
        }
        onFrame?.({ kind: 'end', attemptId: attempt.messageId, turnId, turn, step, aborted: true })
        throw abortError()
      }
      appendAttempt(meta, attempt, friendlyAIError(error))
      onFrame?.({ kind: 'end', attemptId: attempt.messageId, turnId, turn, step, error: true })
      throw error
    }

    // 完整结果兜底：个别 provider 只回传最终值而不发增量
    if (result.text && !attempt.text) {
      attempt.push({ type: 'text-delta', text: result.text })
    }
    if (result.reasoning && !attempt.reasoning) {
      attempt.push({ type: 'reasoning-delta', text: result.reasoning })
    }
    const finalCalls = Array.isArray(result.toolCalls) ? result.toolCalls : []
    const blocks = attempt
      .blocks()
      .filter((block) => block.type !== 'tool-call')
      .concat(
        finalCalls.map((call) => ({
          type: 'tool-call',
          callId: call.toolCallId,
          name: call.toolName,
          arguments: call.args ?? {}
        }))
      )
    session.append(
      AI_EVENT.ASSISTANT_MESSAGE,
      {
        turn,
        step,
        usage: result.usage || null,
        finishReason: result.finishReason || '',
        message: { message_id: attempt.messageId, round_id: turnId, role: 'assistant', content: blocks }
      },
      meta
    )
    onFrame?.({ kind: 'end', attemptId: attempt.messageId, turnId, turn, step })
    toolSet.dispose()

    if (!finalCalls.length) return { kind: 'completed', finishReason: result.finishReason }
    if (forceFinal) return { kind: 'completed', finishReason: result.finishReason, skippedTools: true }

    const batch = finalCalls.map((call) => ({
      callId: call.toolCallId,
      name: call.toolName,
      arguments: call.args ?? {}
    }))
    const execution = await toolsPipeline.execute(batch, {
      turn,
      step,
      roundId: turnId,
      signal: controller?.signal,
      guard
    })
    if (execution.concluded) return { kind: 'concluded' }
    return {
      kind: 'tools',
      loopGuardBreak: execution.loopGuardBreak,
      roundFailed: execution.roundFailed
    }
  }

  /** 一个 turn：可能包含多个 step；返回是否还有下一 turn 需要执行 */
  const runTurn = async () => {
    if (!inbox.nextTurn.length && !inbox.nextStep.length) return false
    const model = getModel?.()
    // 从事件日志实时取（load() 可能在 agent 创建后才载入历史，缓存值会重复编号）
    const turn = session.lastTurn() + 1
    const turnId = uuidv4()
    const meta = { turn }
    session.append(AI_EVENT.TURN_START, { turn, turnId }, meta)
    controller = new AbortController()
    const guard = createLoopGuard()
    workflowGuard.reset()
    let steps = 0
    let forceFinal = false
    let finalPrompted = false
    let pending = false
    let target = inbox.nextTurn.length ? 'next-turn' : 'next-step'
    let outcome = { kind: 'completed' }

    try {
      await prompt.refresh()
      while (true) {
        if (controller.signal.aborted) throw abortError()
        const claimed = inbox.claim(target)
        if (!claimed.length && !pending) break
        pending = false

        if (steps >= MAX_TOOL_ROUNDS) {
          if (finalPrompted) break
          finalPrompted = true
          forceFinal = true
          inbox.inject(userMessage(GRACE_PROMPT_MSG, turnId))
        }
        steps += 1
        session.append(AI_EVENT.STEP_START, { turn, step: steps }, { turn, step: steps })
        const stepResult = await runStep({
          turn,
          turnId,
          step: steps,
          claimed,
          model,
          guard,
          forceFinal
        })
        session.append(
          AI_EVENT.STEP_END,
          { turn, step: steps, reason: { kind: stepResult.kind } },
          { turn, step: steps }
        )

        if (forceFinal) {
          outcome = { kind: 'completed' }
          break
        }

        if (stepResult.kind === 'concluded') {
          outcome = { kind: 'concluded' }
          break
        }

        if (stepResult.kind === 'tools') {
          pending = true
          target = 'next-step'
          const stalled = guard.recordRound(stepResult.roundFailed)
          if (stepResult.loopGuardBreak) {
            forceFinal = true
            continue
          }
          if (stalled >= STALL_ROUNDS) {
            inbox.inject(userMessage(STALL_PROMPT_MSG, turnId))
            forceFinal = true
            continue
          }
          continue
        }

        // 无工具调用的答复：做工作流校验，未通过则注入修复指令继续
        const errors = workflowGuard.inspect()
        if (errors?.length && workflowGuard.canFix()) {
          workflowGuard.consumeFix()
          inbox.inject(userMessage(workflowGuard.buildRepairMessage(errors), turnId))
          pending = true
          target = 'next-step'
          continue
        }
        outcome = { kind: 'completed' }
        break
      }
    } catch (error) {
      if (isAbort(error, controller?.signal)) {
        outcome = { kind: 'aborted' }
      } else {
        outcome = { kind: 'error', error: friendlyAIError(error) }
        console.error('AI turn 执行失败:', error)
        // 模型请求前就失败（如模型未配置）时没有 attempt 事件，补一条可展示的失败事实
        if (!session.events.some((e) => e.turn === turn && e.type === AI_EVENT.ASSISTANT_ATTEMPT)) {
          appendAttempt({ turn, step: Math.max(steps, 1), roundId: turnId }, createAttempt(), friendlyAIError(error))
        }
      }
    } finally {
      session.append(AI_EVENT.TURN_END, { turn, reason: outcome }, meta)
      session.flush()
      controller = null
    }

    return inbox.nextTurn.length > 0
  }

  const wake = () => {
    if (running) return
    if (!inbox.nextTurn.length && !inbox.nextStep.length) return
    running = true
    setStatus('running')
    ;(async () => {
      try {
        let more = await runTurn()
        while (more) more = await runTurn()
      } catch (error) {
        console.error('AI agent 执行异常:', error)
      } finally {
        running = false
        if (inbox.hasPending()) {
          queueMicrotask(wake)
        } else {
          setStatus('idle')
        }
      }
    })()
  }

  return {
    followup(message) {
      inbox.followup(message)
      wake()
    },
    steer(message) {
      inbox.steer(message)
      wake()
    },
    inject(message) {
      inbox.inject(message)
    },
    cancel() {
      inbox.clear()
      controller?.abort()
    },
    get status() {
      return status
    },
    get running() {
      return running
    },
    whenIdle() {
      return new Promise((resolve) => {
        if (!running) return resolve()
        const timer = setInterval(() => {
          if (!running) {
            clearInterval(timer)
            resolve()
          }
        }, 50)
      })
    }
  }
}
