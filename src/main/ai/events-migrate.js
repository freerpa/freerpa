/**
 * @file: AI 会话事件表结构
 * ai_session_events 保存 append-only 会话事实；ai_session_meta 记录迁移版本与最后序号。
 * 与旧 ai_chat_messages 并存：迁移后旧表保持只读，可随时回滚。
 */

export const EVENTS_TABLE = 'ai_session_events'
export const EVENTS_META_TABLE = 'ai_session_meta'

export const ensureEventTables = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      type TEXT NOT NULL,
      turn INTEGER,
      step INTEGER,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(workflow_id, conversation_id, seq),
      UNIQUE(workflow_id, conversation_id, event_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ai_events_conv_seq ON ${EVENTS_TABLE}(conversation_id, seq);
    CREATE INDEX IF NOT EXISTS idx_ai_events_conv_turn ON ${EVENTS_TABLE}(conversation_id, turn);
    CREATE TABLE IF NOT EXISTS ${EVENTS_META_TABLE} (
      workflow_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      format_version INTEGER DEFAULT 1,
      last_seq INTEGER DEFAULT 0,
      migration_version INTEGER DEFAULT 0,
      migrated_at TEXT,
      PRIMARY KEY(workflow_id, conversation_id)
    )
  `)
}
