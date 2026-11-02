/**
 * @file: AI 内核 - 工具执行管线
 * 对齐 dsh core/tools pipeline（精简版）：
 *   pre-execute（顺序，取消/循环守卫）→ execute（exclusive 串行 / parallel 有界滚动池）
 *   → post-execute（失败指纹、finish 判定）→ tool/result 事件
 * 每个 tool/call 都保证有配对的 tool/result，取消与守卫中断也不例外。
 */
import { v4 as uuidv4 } from 'uuid'
import { AI_EVENT } from '../events.js'
import { LOOP_GUARD_MSG } from '../policies/loopGuard'

/** 会改动工作流的工具：成功后标记“有未完成变更”，必须 finish 才能结束本 turn */
const MUTATING_TOOLS = new Set(['addNode', 'connect', 'updateNode', 'deleteNode', 'deleteEdge'])

const normalizeOutput = (output) => {
  const failed = !!(
    output &&
    (output.ok === false || (typeof output === 'string' && output.startsWith('error')))
  )
  return {
    content: typeof output === 'string' ? output : JSON.stringify(output ?? null),
    ok: !failed,
    failed
  }
}

/**
 * @param {{registry:Object, session:Object}} options
 */
export const createToolPipeline = ({ registry, session } = {}) => {
  const executors = registry?.executors || {}

  const invoke = async (call) => {
    const handler = executors[call.name]
    let output
    let durationMs = 0
    if (typeof handler !== 'function') {
      output = { ok: false, error: `未知工具: ${call.name}` }
      console.error(`[AI 工具执行失败] 未知工具 ${call.name}`)
    } else {
      try {
        const started = performance.now()
        output = await handler(call.arguments || {})
        durationMs = Math.round(performance.now() - started)
        console.info(
          `[AI 工具执行] ${call.name}`,
          JSON.stringify(call.arguments || {}),
          '→',
          typeof output === 'string' ? output.slice(0, 500) : JSON.stringify(output)?.slice(0, 500),
          `${durationMs}ms`
        )
      } catch (error) {
        console.error(`[AI 工具执行失败] ${call.name}`, call.arguments, error)
        output = {
          ok: false,
          error: `${error?.message || String(error)}\n  ↳ ${(error?.stack || '')
            .split('\n')
            .slice(1, 4)
            .join('\n  ↳ ')}`
        }
      }
    }
    const normalized = normalizeOutput(output)
    return {
      callId: call.callId,
      name: call.name,
      arguments: call.arguments,
      content: normalized.content,
      ok: normalized.ok,
      failed: normalized.failed,
      durationMs
    }
  }

  const appendCall = (call, meta) => {
    session.append(
      AI_EVENT.TOOL_CALL,
      { ...meta, callId: call.callId, name: call.name, arguments: call.arguments },
      meta
    )
  }

  const commitResult = (outcome, meta, overrideContent) => {
    session.append(
      AI_EVENT.TOOL_RESULT,
      {
        ...meta,
        callId: outcome.callId,
        name: outcome.name,
        ok: overrideContent ? false : outcome.ok,
        durationMs: outcome.durationMs,
        message: {
          message_id: uuidv4(),
          round_id: meta.roundId,
          role: 'tool',
          tool_call_id: outcome.callId,
          tool_name: outcome.name,
          content: overrideContent || outcome.content
        }
      },
      meta
    )
  }

  /**
   * 执行一个 step 的全部工具调用
   * @param {Array} calls [{callId,name,arguments}]
   * @param {{turn:number, step:number, roundId:string, signal?:AbortSignal}} ctx
   * @returns {Promise<{results:Array, concluded:boolean, loopGuardBreak:boolean, roundFailed:boolean}>}
   */
  const execute = async (calls = [], ctx = {}) => {
    const meta = { turn: ctx.turn, step: ctx.step, roundId: ctx.roundId }
    const results = new Array(calls.length)
    let concluded = false
    let loopGuardBreak = false
    let roundFailed = false
    let cursor = 0

    const finishOne = (outcome, index, overrideContent) => {
      results[index] = outcome
      commitResult(outcome, meta, overrideContent)
      // 完成契约：finish 成功 = 本 turn 完成；工作流变更成功 = 记录待完成
      if (outcome.name === 'finish') {
        if (outcome.ok && !overrideContent) {
          concluded = true
          ctx.workflowGuard?.markFinished?.()
        }
      } else if (outcome.ok && MUTATING_TOOLS.has(outcome.name)) {
        ctx.workflowGuard?.markMutation?.()
      }
    }

    /** 中止剩余调用：仍逐个补发 tool/result，避免模型历史出现孤儿 tool_call */
    const abortRemaining = (from, content) => {
      for (let i = from; i < calls.length; i += 1) {
        const call = calls[i]
        appendCall(call, meta)
        const outcome = {
          callId: call.callId,
          name: call.name,
          arguments: call.arguments,
          content,
          ok: false,
          failed: true,
          durationMs: 0
        }
        results[i] = outcome
        commitResult(outcome, meta, content)
      }
    }

    try {
      while (cursor < calls.length) {
        if (ctx.signal?.aborted) {
          abortRemaining(cursor, 'aborted: 用户已取消本次生成')
          break
        }
        const call = calls[cursor]
        if (!registry.isConcurrencySafe(call.name)) {
          // exclusive：一次一个
          const index = cursor
          cursor += 1
          if (ctx.signal?.aborted) {
            abortRemaining(index, 'aborted: 用户已取消本次生成')
            break
          }
          appendCall(call, meta)
          const outcome = await invoke(call)
          let override = null
          // finish 失败是“校验未通过”的正常反馈，不参与失败指纹（否则空参数 finish 失败两次就会被误判为死循环）
          if (outcome.name !== 'finish' && outcome.failed) {
            if (ctx.guard?.recordFailure?.(call)) {
              loopGuardBreak = true
              override = LOOP_GUARD_MSG
            }
          }
          finishOne({ ...outcome, ok: override ? false : outcome.ok }, index, override)
          if (loopGuardBreak) {
            abortRemaining(cursor, 'blocked: 本轮工具执行已终止（loop guard）')
            break
          }
          continue
        }
        // parallel：收集连续只读调用，有界滚动池并发执行，结果按模型顺序提交
        const group = []
        while (cursor < calls.length && registry.isConcurrencySafe(calls[cursor].name)) {
          group.push({ call: calls[cursor], index: cursor })
          cursor += 1
        }
        group.forEach(({ call: item }) => appendCall(item, meta))
        const outcomes = await Promise.all(group.map(({ call: item }) => invoke(item)))
        for (let i = 0; i < outcomes.length; i += 1) {
          const outcome = outcomes[i]
          let override = null
          if (outcome.name !== 'finish' && outcome.failed) {
            if (ctx.guard?.recordFailure?.(group[i].call)) {
              loopGuardBreak = true
              override = LOOP_GUARD_MSG
            }
          }
          // 只覆盖触发守卫的那个调用；同组已完成的只读结果按真实结果提交
          finishOne(override ? { ...outcome, ok: false } : outcome, group[i].index, override)
        }
        if (loopGuardBreak) {
          abortRemaining(cursor, 'blocked: 本轮工具执行已终止（loop guard）')
          break
        }
      }
    } catch (error) {
      // 管线级异常：把剩余调用补成失败结果，绝不留下无配对 tool_call
      console.error('工具管线执行异常:', error)
      abortRemaining(cursor, `error: 工具执行异常：${error?.message || String(error)}`)
    }

    // “无进展”= 本 step 所有调用都失败；只要成功了一个（含部分成功）就不算停滞，
    // 避免“探测性失败 → 下一轮修正”被误判为死循环而提前收尾
    const settled = results.filter(Boolean)
    roundFailed = settled.length > 0 && settled.every((result) => result.failed)
    return { results: settled, concluded, loopGuardBreak, roundFailed }
  }

  return { execute, invoke }
}
