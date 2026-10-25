/**
 * @file: AI 内核 - 事件词汇与信封
 * 与 shared/ai-events.js 的 AI_EVENT 保持一致；此处负责运行时事件生成（纯函数，不依赖 Vue）。
 */
import { v4 as uuidv4 } from 'uuid'
import { AI_EVENT } from '../../../../shared/ai-events.js'

export { AI_EVENT }

/** 必须落库的事件类型（chunk 等瞬时帧不在此列） */
export const DURABLE_EVENTS = new Set(Object.values(AI_EVENT))

/** 深拷贝为可结构化克隆的纯对象（避免 Proxy/响应式对象跨越 IPC） */
export const toPlain = (value) => {
  if (value === undefined || value === null) return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

/**
 * 构造事件信封
 * @param {string} type AI_EVENT 之一
 * @param {Object} data 事件负载
 * @param {{turn?:number, step?:number}} meta 归属的 turn/step
 */
export const createEvent = (type, data = {}, meta = {}) => ({
  seq: 0,
  id: uuidv4(),
  type,
  turn: meta.turn ?? null,
  step: meta.step ?? null,
  data,
  ts: Date.now()
})

export const isDurable = (type) => DURABLE_EVENTS.has(type)
