/**
 * @file: AI 会话事件持久化（append-only）
 * 事件是唯一事实来源：会话恢复靠 loadEvents 重放，旧消息表仅保留只读历史。
 */
import { initDatabase } from '../data/db.js'
import { getMessages } from './messageStore.js'
import { ensureTables } from './messages-migrate.js'
import { legacyMessagesToEvents } from '../../shared/ai-events.js'
import { ensureEventTables, EVENTS_TABLE, EVENTS_META_TABLE } from './events-migrate.js'

const parseData = (raw) => {
  if (typeof raw !== 'string') return raw || {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const fromRow = (row) => ({
  seq: row.seq,
  id: row.event_id,
  type: row.type,
  turn: row.turn ?? null,
  step: row.step ?? null,
  data: parseData(row.data),
  ts: row.created_at ? Date.parse(String(row.created_at).replace(' ', 'T')) || null : null
})

const toPlain = (event) => JSON.parse(JSON.stringify(event))

/** 读取会话事件（按 seq 升序） */
export const loadEvents = async (workflowId, conversationId) => {
  const db = await initDatabase()
  await ensureEventTables(db)
  const [rows, meta] = await Promise.all([
    db.all(
      `SELECT * FROM ${EVENTS_TABLE}
       WHERE workflow_id = ? AND conversation_id = ?
       ORDER BY seq ASC`,
      workflowId,
      conversationId
    ),
    db.get(
      `SELECT * FROM ${EVENTS_META_TABLE} WHERE workflow_id = ? AND conversation_id = ?`,
      workflowId,
      conversationId
    )
  ])
  return {
    events: rows.map(fromRow),
    lastSeq: meta?.last_seq || rows.reduce((max, r) => Math.max(max, r.seq || 0), 0),
    meta: meta || null
  }
}

/** 追加事件：seq/event_id 唯一约束保证幂等；同步更新会话更新时间与 meta */
export const appendEvents = async (workflowId, conversationId, events = []) => {
  const db = await initDatabase()
  await ensureEventTables(db)
  await ensureTables(db)
  const list = Array.isArray(events) ? events.filter((e) => e && e.type) : []
  if (!list.length) return { appended: 0, lastSeq: 0 }
  let lastSeq = 0
  await db.exec('BEGIN')
  try {
    for (const event of list) {
      const plain = toPlain(event)
      lastSeq = Math.max(lastSeq, Number(plain.seq) || 0)
      await db.run(
        `INSERT OR IGNORE INTO ${EVENTS_TABLE}
          (workflow_id, conversation_id, seq, event_id, type, turn, step, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now','localtime')))`,
        workflowId,
        conversationId,
        Number(plain.seq) || 0,
        String(plain.id || ''),
        String(plain.type),
        plain.turn ?? null,
        plain.step ?? null,
        JSON.stringify(plain.data || {}),
        plain.ts ? new Date(plain.ts).toISOString() : null
      )
    }
    await db.run(
      `INSERT INTO ${EVENTS_META_TABLE} (workflow_id, conversation_id, format_version, last_seq, migration_version)
       VALUES (?, ?, 1, ?, 1)
       ON CONFLICT(workflow_id, conversation_id) DO UPDATE SET
         format_version = 1,
         last_seq = MAX(${EVENTS_META_TABLE}.last_seq, excluded.last_seq)`,
      workflowId,
      conversationId,
      lastSeq
    )
    await db.run(
      `UPDATE ai_conversations SET updated_at = datetime('now','localtime')
       WHERE workflow_id = ? AND id = ?`,
      workflowId,
      conversationId
    )
    await db.exec('COMMIT')
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
  return { appended: list.length, lastSeq }
}

/** 删除会话的全部事件与 meta（删除会话时与旧消息表一并清理） */
export const deleteConversationEvents = async (workflowId, conversationId) => {
  const db = await initDatabase()
  await ensureEventTables(db)
  await db.exec('BEGIN')
  try {
    await db.run(
      `DELETE FROM ${EVENTS_TABLE} WHERE workflow_id = ? AND conversation_id = ?`,
      workflowId,
      conversationId
    )
    await db.run(
      `DELETE FROM ${EVENTS_META_TABLE} WHERE workflow_id = ? AND conversation_id = ?`,
      workflowId,
      conversationId
    )
    await db.exec('COMMIT')
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
}

/**
 * 旧消息 → 事件（每个会话幂等）
 * - meta 已存在 → 跳过
 * - 已存在事件（新格式）→ 只补 meta，不迁移
 * - 无旧消息 → 只补 meta
 */
export const migrateConversation = async (workflowId, conversationId = 'default') => {
  const db = await initDatabase()
  await ensureEventTables(db)
  const meta = await db.get(
    `SELECT * FROM ${EVENTS_META_TABLE} WHERE workflow_id = ? AND conversation_id = ?`,
    workflowId,
    conversationId
  )
  if (meta) return { skipped: true, reason: 'meta-exists', events: 0 }

  const eventCount = await db.get(
    `SELECT COUNT(*) AS cnt FROM ${EVENTS_TABLE} WHERE workflow_id = ? AND conversation_id = ?`,
    workflowId,
    conversationId
  )
  if ((eventCount?.cnt || 0) > 0) {
    await db.run(
      `INSERT OR IGNORE INTO ${EVENTS_META_TABLE}
        (workflow_id, conversation_id, format_version, last_seq, migration_version)
       VALUES (?, ?, 1, ?, 1)`,
      workflowId,
      conversationId,
      eventCount.cnt
    )
    return { skipped: true, reason: 'events-exist', events: eventCount.cnt }
  }

  const legacy = await getMessages(workflowId, conversationId)
  const events = legacyMessagesToEvents(legacy)
  await db.exec('BEGIN')
  try {
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]
      await db.run(
        `INSERT OR IGNORE INTO ${EVENTS_TABLE}
          (workflow_id, conversation_id, seq, event_id, type, turn, step, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now','localtime')))`,
        workflowId,
        conversationId,
        index + 1,
        event.id,
        event.type,
        event.turn ?? null,
        event.step ?? null,
        JSON.stringify(event.data || {}),
        // 保留旧消息原始时间：UI 的时间线与耗时依赖事件时间戳
        event.ts ? new Date(event.ts).toISOString() : null
      )
    }
    await db.run(
      `INSERT INTO ${EVENTS_META_TABLE}
        (workflow_id, conversation_id, format_version, last_seq, migration_version, migrated_at)
       VALUES (?, ?, 1, ?, 1, datetime('now','localtime'))
       ON CONFLICT(workflow_id, conversation_id) DO UPDATE SET
         migration_version = 1,
         last_seq = excluded.last_seq,
         migrated_at = excluded.migrated_at`,
      workflowId,
      conversationId,
      events.length
    )
    await db.exec('COMMIT')
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
  return { skipped: false, events: events.length }
}
