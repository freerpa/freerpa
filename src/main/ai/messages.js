/**
 * @file: AI 聊天记录持久化（sqlite：会话表 + 消息表，按 workflowId 隔离）
 * 多会话模型：ai_conversations（会话）+ ai_chat_messages（消息，conversation_id 关联）
 * 消息结构：{ message_id, role, content, reasoning_content, tool_calls, tool_call_id, attachments }
 * role: user / assistant / tool —— tool 消息用于会话上下文完整恢复
 */
import { initDatabase } from '../data/db.js'
import { v4 as uuidv4 } from 'uuid'

const TABLE = 'ai_chat_messages'
const CONV_TABLE = 'ai_conversations'
const MEMORY_TABLE = 'ai_memories'

const ensureTables = async (db) => {
  // 会话表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${CONV_TABLE} (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      title TEXT DEFAULT '新对话',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS ${MEMORY_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(workflow_id, key)
    )
  `)
  // 消息表：检测旧表（缺 conversation_id / 旧 UNIQUE(workflow_id, message_id)）→ 迁移重建为三列 UNIQUE
  const existing = await db.get(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    TABLE
  )
  if (existing) {
    // cols 为当前表结构快照；重建迁移后新表已含全部新列，必须刷新快照，否则会对新表重复 ALTER（duplicate column 崩溃）
    let cols = await db.all(`PRAGMA table_info(${TABLE})`)
    if (!cols.some((c) => c.name === 'conversation_id')) {
      // 旧表迁移（事务）：RENAME → 建新表（三列 UNIQUE）→ 复制（旧消息归 'default' 会话）→ 删旧表
      await db.exec('BEGIN')
      try {
        await db.exec(`ALTER TABLE ${TABLE} RENAME TO ${TABLE}_old`)
        await db.exec(`
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workflow_id TEXT NOT NULL,
            conversation_id TEXT NOT NULL DEFAULT 'default',
            message_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT DEFAULT '',
            reasoning_content TEXT DEFAULT '',
            tool_calls TEXT DEFAULT '[]',
            tool_call_id TEXT DEFAULT '',
            attachments TEXT DEFAULT '[]',
            round_id TEXT DEFAULT '',
            duration_ms INTEGER DEFAULT NULL,
            usage TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            UNIQUE(workflow_id, conversation_id, message_id)
          )
        `)
        // 旧表列集合（兼容最早版本无 attachments 列的表）
        const oldCols = (await db.all(`PRAGMA table_info(${TABLE}_old)`)).map((c) => c.name)
        const hasOldAttachments = oldCols.includes('attachments')
        const selCols = [
          'workflow_id',
          `'default' AS conversation_id`,
          'message_id',
          'role',
          'content',
          'reasoning_content',
          'tool_calls',
          'tool_call_id',
          hasOldAttachments ? 'attachments' : `'[]' AS attachments`,
          `'' AS round_id`,
          `'' AS usage`,
          'created_at'
        ].join(', ')
        await db.exec(
          `INSERT INTO ${TABLE}
            (workflow_id, conversation_id, message_id, role, content, reasoning_content, tool_calls, tool_call_id, attachments, round_id, usage, created_at)
           SELECT ${selCols} FROM ${TABLE}_old`
        )
        await db.exec(`DROP TABLE ${TABLE}_old`)
        await db.exec('COMMIT')
        // 重建完成：刷新表结构快照（新表已含 round_id/duration_ms）
        cols = await db.all(`PRAGMA table_info(${TABLE})`)
      } catch (error) {
        await db.exec('ROLLBACK')
        throw error
      }
    }
    if (!cols.some((c) => c.name === 'round_id')) {
      // 已有 conversation_id 的表缺 round_id：轻量补列（旧消息 round_id 为空串，UI 按 user 边界启发式分组）
      await db.exec(`ALTER TABLE ${TABLE} ADD COLUMN round_id TEXT DEFAULT ''`)
    }
    if (!cols.some((c) => c.name === 'duration_ms')) {
      // 已有表缺 duration_ms（工具执行耗时，跨会话展示）：轻量补列
      await db.exec(`ALTER TABLE ${TABLE} ADD COLUMN duration_ms INTEGER DEFAULT NULL`)
    }
    if (!cols.some((c) => c.name === 'usage')) {
      // 已有表缺 usage（AI 调用 token 用量，跟随会话持久化展示）：轻量补列
      await db.exec(`ALTER TABLE ${TABLE} ADD COLUMN usage TEXT DEFAULT ''`)
    }
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL DEFAULT 'default',
        message_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT DEFAULT '',
        reasoning_content TEXT DEFAULT '',
        tool_calls TEXT DEFAULT '[]',
        tool_call_id TEXT DEFAULT '',
        attachments TEXT DEFAULT '[]',
        round_id TEXT DEFAULT '',
        duration_ms INTEGER DEFAULT NULL,
        usage TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        UNIQUE(workflow_id, conversation_id, message_id)
      )
    `)
  }
}

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
