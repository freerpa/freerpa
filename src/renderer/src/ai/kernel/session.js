/**
 * @file: AI 内核 - 会话（append-only 事件日志）
 * 与 dsh core/session 对齐：内存中只追加事件，UI/模型历史全部由 projections 派生。
 * 持久化通过 persistence 注入，session 本身不关心存储介质。
 */
import { AI_EVENT, createEvent, toPlain } from './events.js'
import { deriveModelMessages, deriveUiMessages } from './projections.js'

/**
 * @param {{workflowId:string, conversationId:string, persistence?:Object}} options
 */
export const createSession = ({ workflowId, conversationId, persistence } = {}) => {
  let events = []
  let seq = 0
  const listeners = new Set()

  const notify = (event) => {
    listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error('会话事件订阅回调失败:', error)
      }
    })
  }

  const append = (type, data = {}, meta = {}) => {
    const event = createEvent(type, toPlain(data), meta)
    event.seq = seq + 1
    seq = event.seq
    events.push(event)
    persistence?.enqueue?.(event)
    notify(event)
    return event
  }

  /** 载入已持久化事件（seq 已存在，不再重新入队） */
  const replace = (loaded = []) => {
    events = loaded.map((event) => ({ ...event, data: event.data || {} }))
    seq = events.reduce((max, event) => Math.max(max, Number(event.seq) || 0), 0)
    notify({ type: 'session/replaced' })
  }

  const markDeleted = (messageIds = [], toolCallIds = [], meta = {}) => {
    if (!messageIds.length && !toolCallIds.length) return null
    return append(AI_EVENT.MESSAGE_DELETE, { messageIds, toolCallIds }, meta)
  }

  const lastTurn = () => events.reduce((max, event) => Math.max(max, Number(event.turn) || 0), 0)

  return {
    get workflowId() {
      return workflowId
    },
    get conversationId() {
      return conversationId
    },
    get events() {
      return events
    },
    get lastSeq() {
      return seq
    },
    lastTurn,
    append,
    replace,
    markDeleted,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    deriveUi: () => deriveUiMessages(events),
    deriveModel: () => deriveModelMessages(events),
    flush: () => persistence?.flush?.()
  }
}
