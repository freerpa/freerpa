/**
 * @file: AI 聊天记录持久化（sqlite：会话表 + 消息表，按 workflowId 隔离）
 * 多会话模型：ai_conversations（会话）+ ai_chat_messages（消息，conversation_id 关联）
 * 消息结构：{ message_id, role, content, reasoning_content, tool_calls, tool_call_id, attachments }
 * role: user / assistant / tool —— tool 消息用于会话上下文完整恢复
 * 表结构与迁移见 messages-migrate.js（一次性逻辑独立维护）
 */
import { initDatabase } from '../data/db.js'
import { v4 as uuidv4 } from 'uuid'
import { ensureTables } from './messages-migrate.js'

const TABLE = 'ai_chat_messages'
const CONV_TABLE = 'ai_conversations'
const MEMORY_TABLE = 'ai_memories'

const toRow = (m) => ({
  workflow_id: m.workflowId,
  conversation_id: m.conversationId || 'default',
  message_id: m.message_id,
  role: m.role,
  content: m.content || '',
  reasoning_content: m.reasoning_content || '',
  tool_calls: m.tool_calls ? JSON.stringify(m.tool_calls) : '[]',
  tool_call_id: m.tool_call_id || '',
  attachments: m.attachments ? JSON.stringify(m.attachments) : '[]',
  round_id: m.round_id || '',
  duration_ms: m.duration_ms ?? null,
  usage: m._usage ? JSON.stringify(m._usage) : ''
})

const fromRow = (row) => ({
  message_id: row.message_id,
  role: row.role,
  content: row.content,
  reasoning_content: row.reasoning_content,
  tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : [],
  tool_call_id: row.tool_call_id,
  attachments: row.attachments ? JSON.parse(row.attachments) : [],
  round_id: row.round_id || '',
  duration_ms: row.duration_ms ?? null,
  usage: row.usage ? JSON.parse(row.usage) : null,
  created_at: row.created_at
})

// ---- 会话 ----

/** 创建新会话 */
export const createConversation = async (workflowId, title = '新对话') => {
  const db = await initDatabase()
  await ensureTables(db)
  const id = uuidv4()
  await db.run(
    `INSERT INTO ${CONV_TABLE} (id, workflow_id, title) VALUES (?, ?, ?)`,
    id,
    workflowId,
    title
  )
  return { id, workflowId, title, createdAt: new Date().toLocaleString() }
}

/** 会话列表（按更新时间倒序，展示标题取首条 user 消息前缀） */
export const getConversations = async (workflowId) => {
  const db = await initDatabase()
  await ensureTables(db)
  const rows = await db.all(
    `SELECT c.*,
       (SELECT COUNT(*) FROM ${TABLE} m WHERE m.workflow_id = c.workflow_id AND m.conversation_id = c.id) AS message_count,
       (SELECT m.content FROM ${TABLE} m WHERE m.workflow_id = c.workflow_id AND m.conversation_id = c.id AND m.role = 'user' ORDER BY m.id ASC LIMIT 1) AS first_user
     FROM ${CONV_TABLE} c
     WHERE c.workflow_id = ?
     ORDER BY c.updated_at DESC`,
    workflowId
  )
  // 兼容旧数据：历史消息存在 conversation_id='default' 但未建会话记录，虚拟展示
  if (!rows.some((r) => r.id === 'default')) {
    const firstUser = await db.get(
      `SELECT content FROM ${TABLE} WHERE workflow_id = ? AND conversation_id = 'default' AND role = 'user' ORDER BY id ASC LIMIT 1`,
      workflowId
    )
    if (firstUser) {
      const stat = await db.get(
        `SELECT COUNT(*) AS cnt, MAX(created_at) AS last_at FROM ${TABLE} WHERE workflow_id = ? AND conversation_id = 'default'`,
        workflowId
      )
      rows.push({
        id: 'default',
        title: firstUser.content.slice(0, 30),
        message_count: stat.cnt || 0,
        created_at: stat.last_at || '',
        updated_at: stat.last_at || ''
      })
    }
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.first_user ? r.first_user.slice(0, 30) : r.title || '新对话',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    messageCount: r.message_count || 0
  }))
}

/** 删除会话及其消息 */
export const deleteConversation = async (workflowId, conversationId) => {
  const db = await initDatabase()
  await ensureTables(db)
  await db.run(`DELETE FROM ${TABLE} WHERE workflow_id = ? AND conversation_id = ?`, workflowId, conversationId)
  await db.run(`DELETE FROM ${CONV_TABLE} WHERE workflow_id = ? AND id = ?`, workflowId, conversationId)
}

// ---- 消息 ----

export const getMessages = async (workflowId, conversationId = 'default') => {
  const db = await initDatabase()
  await ensureTables(db)
  const rows = await db.all(
    `SELECT * FROM ${TABLE} WHERE workflow_id = ? AND conversation_id = ? ORDER BY id ASC`,
    workflowId,
    conversationId
  )
  return rows.map(fromRow)
}

/** 按 message_id 幂等保存（保留原行 id 与 created_at，保证恢复顺序稳定；同步会话时间） */
export const saveMessage = async (workflowId, conversationId = 'default', message) => {
  const db = await initDatabase()
  await ensureTables(db)
  const row = toRow({ ...message, workflowId, conversationId })
  // 必须用 ON CONFLICT DO UPDATE：INSERT OR REPLACE 会删除+重插（AUTOINCREMENT 使
  // rowid 增大，被覆盖行跳到表尾），含工具调用的一轮会话恢复顺序会变成
  // user→tool→assistant，tool-result 无配对导致接口 400
  await db.run(
    `INSERT INTO ${TABLE}
      (workflow_id, conversation_id, message_id, role, content, reasoning_content, tool_calls, tool_call_id, attachments, round_id, duration_ms, usage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM ${TABLE} WHERE workflow_id=? AND conversation_id=? AND message_id=?), datetime('now','localtime')))
     ON CONFLICT(workflow_id, conversation_id, message_id) DO UPDATE SET
       role = excluded.role,
       content = excluded.content,
       reasoning_content = excluded.reasoning_content,
       tool_calls = excluded.tool_calls,
       tool_call_id = excluded.tool_call_id,
       attachments = excluded.attachments,
       round_id = excluded.round_id,
       duration_ms = excluded.duration_ms,
       usage = excluded.usage`,
    row.workflow_id,
    row.conversation_id,
    row.message_id,
    row.role,
    row.content,
    row.reasoning_content,
    row.tool_calls,
    row.tool_call_id,
    row.attachments,
    row.round_id,
    row.duration_ms,
    row.usage,
    workflowId,
    conversationId,
    message.message_id
  )
  // 会话存在则刷新 updated_at（历史 'default' 会话可能不存在于会话表，静默忽略）
  await db.run(
    `UPDATE ${CONV_TABLE} SET updated_at = datetime('now','localtime') WHERE id = ?`,
    conversationId
  )
}

export const deleteMessage = async (workflowId, conversationId = 'default', messageId) => {
  const db = await initDatabase()
  await ensureTables(db)
  await db.run(
    `DELETE FROM ${TABLE} WHERE workflow_id = ? AND conversation_id = ? AND message_id = ?`,
    workflowId,
    conversationId,
    messageId
  )
}

export const clearMessages = async (workflowId, conversationId = 'default') => {
  const db = await initDatabase()
  await ensureTables(db)
  await db.run(
    `DELETE FROM ${TABLE} WHERE workflow_id = ? AND conversation_id = ?`,
    workflowId,
    conversationId
  )
}

// ---- 轻量记忆（按 workflowId 隔离，每轮召回注入 turn 尾部） ----

/** 读取工作流记忆（按更新时间倒序） */
export const getMemories = async (workflowId) => {
  const db = await initDatabase()
  await ensureTables(db)
  const rows = await db.all(
    `SELECT key, value FROM ${MEMORY_TABLE} WHERE workflow_id = ? ORDER BY updated_at DESC`,
    workflowId
  )
  return rows.map((r) => ({ key: r.key, value: r.value }))
}
