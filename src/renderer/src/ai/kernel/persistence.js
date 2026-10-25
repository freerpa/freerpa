/**
 * @file: AI 内核 - 事件持久化（renderer 侧）
 * 批量追加事件；加载时先触发主进程幂等迁移，主进程迁移失败时用 shared 转换器在渲染端兜底。
 */
import { loadEvents, appendEvents, migrateEvents, getChatMessages } from '@/api/aiModels'
import { legacyMessagesToEvents } from '../../../../shared/ai-events.js'
import { toPlain } from './events.js'

const FLUSH_DELAY = 50

export const createEventPersistence = ({ workflowId, conversationId } = {}) => {
  let queue = []
  let timer = null
  let flushing = false

  const schedule = () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      flush()
    }, FLUSH_DELAY)
  }

  const flush = async () => {
    if (flushing || !queue.length) return
    flushing = true
    const batch = queue
    queue = []
    try {
      await appendEvents(workflowId, conversationId, batch.map(toPlain))
    } catch (error) {
      // 写失败放回队首，下一次 flush 重试；事件本身仍留在内存日志中
      queue = batch.concat(queue)
      console.error('会话事件写入失败:', error)
    } finally {
      flushing = false
      if (queue.length) schedule()
    }
  }

  const load = async () => {
    try {
      await migrateEvents(workflowId, conversationId)
      const result = await loadEvents(workflowId, conversationId)
      if (result?.events?.length) return result
    } catch (error) {
      console.error('会话事件迁移/加载失败，降级读取旧消息:', error)
    }
    // 兜底：主进程迁移不可用时，渲染端把旧消息转换为同构事件（只读）
    try {
      const legacy = await getChatMessages(workflowId, conversationId)
      const converted = legacyMessagesToEvents(legacy || []).map((event, index) => ({
        ...event,
        seq: index + 1,
        ts: event.ts || event.data?.message?._ts || Date.now()
      }))
      return { events: converted, lastSeq: converted.length, meta: null, fallback: true }
    } catch (error) {
      console.error('旧消息读取失败:', error)
      return { events: [], lastSeq: 0, meta: null }
    }
  }

  return {
    enqueue(event) {
      queue.push(event)
      schedule()
    },
    flush,
    load,
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
      flush()
    }
  }
}
