/**
 * @file: AI 工具执行与循环守卫（useAiChat send() 的独立子流程）
 * - executeToolCalls：遍历执行一轮工具调用，统一失败结构化、失败指纹、loop-guard 注入、tool 消息构建
 * - 守卫提示消息常量（loop-guard / stall / grace）
 */
import { v4 as uuidv4 } from 'uuid'

const MAX_LOOP_GUARD_FAILURES = 2 // 同一工具同一参数连续失败次数 → 阻断循环
export const STALL_ROUNDS = 4 // 连续无进展轮数 → 提示输出结论

export const LOOP_GUARD_MSG =
  'blocked: [loop guard] 同一工具调用已连续失败，请停止重试并修正参数或改用其他方式，然后直接输出阶段性结论或询问用户'
export const STALL_PROMPT_MSG =
  '提示：已连续多轮没有进展，请基于已有信息输出阶段性结论，或向用户询问下一步操作。'
export const GRACE_PROMPT_MSG =
  '提示：已达到工具调用轮次上限。请基于已完成的工具结果直接输出最终回复，不要再调用工具。'

/**
 * 执行一轮工具调用，结果写入上下文并持久化。
 * @param {Object} opts
 * @param {Array}  opts.toolCalls          本轮 assistant 的 tool_calls（AI SDK 格式 { toolCallId, toolName, args }）
 * @param {string} opts.roundId            当前轮次 ID（工具结果消息共享，UI 据此分组）
 * @param {Object} opts.executors          工具名 → 执行器
 * @param {Function} opts.persistIn        持久化 tool 消息（吞错）
 * @param {Array}  opts.contextMessages    提交给模型的完整上下文（tool 消息 push 至此）
 * @param {Array}  opts.messages           UI 消息源（tool 消息同步 push，供 buildRoundGroups 合并卡片）
 * @param {Map}    opts.failureFingerprints 失败指纹计数（跨轮保留）
 * @returns {Promise<{ finished: boolean, loopGuardBreak: boolean, roundFailed: boolean }>}
 */
export const executeToolCalls = async ({
  toolCalls,
  roundId,
  executors,
  persistIn,
  contextMessages,
  messages,
  failureFingerprints
}) => {
  let finished = false // finish 表示模型已达目标，执行后结束本轮
  let roundFailed = false
  let loopGuardBreak = false
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
      console.error(`[AI 工具执行失败] ${tc.toolName}`, tc.args, error)
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
  return { finished, loopGuardBreak, roundFailed }
}
