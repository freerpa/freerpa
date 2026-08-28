/**
 * @file: AI 聊天表结构迁移（一次性逻辑，独立于 CRUD 便于维护）
 * 负责 ai_conversations / ai_chat_messages / ai_memories 三张表的建表与旧表迁移。
 */

const TABLE = 'ai_chat_messages'
const CONV_TABLE = 'ai_conversations'
const MEMORY_TABLE = 'ai_memories'

/**
 * 确保聊天相关表存在（含旧表结构迁移）。
 * - 旧消息表（缺 conversation_id / 旧 UNIQUE(workflow_id, message_id)）→ 事务重建为三列 UNIQUE
 * - 缺 round_id / duration_ms / usage 列 → 轻量补列
 */
export const ensureTables = async (db) => {
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
