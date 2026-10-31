/**
 * @file: AI 内核 - Agent driver（turn 生命周期 + 渲染层 host 服务）
 * 主进程 LangGraph 负责 turn 内的 step 循环（提示组装、模型调用、工具轮次、校验修复）；
 * 渲染层只负责：
 *  - turn 启停与 inbox 用户消息入队
 *  - 事件落库（主进程产出的 step/system/assistant 事件 + 本地工具管线事件）
 *  - host 服务：assemblePrompt / runTools / workflowCheck（依赖画布与工具执行器）
 *  - 瞬时流式帧（onFrame，不落库）
 */
import { v4 as uuidv4 } from 'uuid'
import { AI_EVENT, toPlain } from './events.js'
import { prepareRequestMessages, friendlyAIError } from './policies/contextBudget'
import { createLoopGuard } from './policies/loopGuard'

const abortError = () => {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

const isAbort = (error, signal) => error?.name === 'AbortError' || !!signal?.aborted

/** 主进程 part → 实时帧 chunk */
const partToChunk = (part) => {
  if (part.type === 'text') return { type: 'text-delta', text: part.text || '' }
  if (part.type === 'reasoning') return { type: 'reasoning-delta', text: part.text || '' }
  if (part.type === 'tool-call') {
    return { type: 'tool-call', callId: part.toolCallId, name: part.toolName, input: part.args ?? {} }
  }
  if (part.type === 'tool-arg') {
    return { type: 'tool-call-delta', callId: part.toolCallId, delta: part.arg || '' }
  }
  return null
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
  let guard = null

  const setStatus = (next) => {
    status = next
    onStatus?.(next)
  }

  /** 渲染层 host 服务：主进程按需回调 */
  const hostCall = async (method, payload = {}) => {
    const meta = {
      turn: payload.turn ?? 0,
      step: payload.step ?? 0,
      roundId: payload.roundId
    }
    if (method === 'assemblePrompt') {
      return prompt.assemble()
    }
    if (method === 'runTools') {
      const calls = (payload.calls || []).map((call) => ({
        callId: call.callId,
        name: call.name,
        arguments: call.arguments || {}
      }))
      return toolsPipeline.execute(calls, {
        ...meta,
        signal: controller?.signal,
        guard
      })
    }
    if (method === 'workflowCheck') {
      const errors = workflowGuard.inspect()
      if (Array.isArray(errors) && errors.length > 0 && workflowGuard.canFix()) {
        workflowGuard.consumeFix()
        return {
          errors: errors.map((error) => error.message),
          canFix: true,
          repairMessage: workflowGuard.buildRepairMessage(errors)
        }
      }
      return {
        errors: Array.isArray(errors) ? errors.map((error) => error.message) : [],
        canFix: false,
        repairMessage: ''
      }
    }
    throw new Error(`未知 host 方法: ${method}`)
  }

  const appendClaimed = (claimed, turn, turnId) => {
    for (const message of claimed) {
      session.append(
        AI_EVENT.USER_MESSAGE,
        {
          turn,
          step: 0,
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
        { turn }
      )
    }
  }

  /** 一个 turn：主进程执行所有 step，渲染层负责入队/事件/host */
  const runTurn = async () => {
    if (!inbox.hasPending()) return false
    const model = getModel?.()
    // 从事件日志实时取（load() 可能在 agent 创建后才载入历史，缓存值会重复编号）
    const turn = session.lastTurn() + 1
    const turnId = uuidv4()
    session.append(AI_EVENT.TURN_START, { turn, turnId }, { turn })

    controller = new AbortController()
    guard = createLoopGuard()
    workflowGuard.reset()
    let outcome = { kind: 'completed' }
    let toolSet = null

    try {
      await prompt.refresh()

      let claimed = inbox.claim('next-turn')
      if (!claimed.length) claimed = inbox.claim('next-step')
      if (!claimed.length) throw abortError()
      appendClaimed(claimed, turn, turnId)

      toolSet = registry.resolve()
      const history = prepareRequestMessages(session.deriveModel(), model).filter(
        (message) => !(message.role === 'user' && message.source === 'runtime-context')
      )

      const result = await llm.runTurn(
        {
          providerId: model?.providerId,
          modelId: model?.modelId,
          messages: toPlain(history),
          tools: toPlain(toolSet.tools),
          turn,
          turnId
        },
        controller.signal,
        {
          onEvent: (event) => {
            session.append(event.type, event.data, {
              turn: event.turn ?? turn,
              step: event.step ?? null
            })
          },
          onHostCall: hostCall,
          onPart: (part) => {
            if (part.type === 'attempt-start') {
              onFrame?.({
                kind: 'start',
                attemptId: part.attemptId,
                turnId: part.turnId || turnId,
                turn: part.turn ?? turn,
                step: part.step ?? 0
              })
              return
            }
            if (part.type === 'attempt-end') {
              onFrame?.({
                kind: 'end',
                attemptId: part.attemptId,
                turnId: part.turnId || turnId,
                turn: part.turn ?? turn,
                step: part.step ?? 0,
                aborted: !!part.aborted,
                error: !!part.error
              })
              return
            }
            const chunk = partToChunk(part)
            if (chunk) {
              onFrame?.({
                kind: 'chunk',
                attemptId: part.attemptId,
                turnId,
                turn,
                step: part.step ?? 0,
                chunk
              })
            }
          }
        }
      )

      outcome = result?.aborted ? { kind: 'aborted' } : result?.outcome || { kind: 'completed' }
      if (outcome.kind === 'aborted') throw abortError()
    } catch (error) {
      if (isAbort(error, controller?.signal)) {
        outcome = { kind: 'aborted' }
      } else {
        outcome = { kind: 'error', error: friendlyAIError(error) }
        console.error('AI turn 执行失败:', error)
        // 模型请求前就失败（如模型未配置）时没有 attempt 事件，补一条可展示的失败事实
        if (!session.events.some((event) => event.turn === turn && event.type === AI_EVENT.ASSISTANT_ATTEMPT)) {
          session.append(
            AI_EVENT.ASSISTANT_ATTEMPT,
            {
              turn,
              step: 1,
              message: {
                message_id: uuidv4(),
                round_id: turnId,
                role: 'assistant',
                content: []
              },
              error: friendlyAIError(error)
            },
            { turn, step: 1 }
          )
        }
      }
    } finally {
      toolSet?.dispose?.()
      session.append(AI_EVENT.TURN_END, { turn, reason: outcome }, { turn })
      session.flush()
      controller = null
      guard = null
    }

    return inbox.nextTurn.length > 0
  }

  const wake = () => {
    if (running) return
    if (!inbox.hasPending()) return
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
      llm.abort?.()
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
