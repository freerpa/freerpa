/**
 * @file: 全局配置存储（settings 表）— DB 版 key-value
 * 替代 <userData>/user-preferences JSON 文件。
 * value 统一存 JSON 字符串（兼容字符串/数组/对象，如 permissions/aiProviders）。
 */
export const ensureSettingsTable = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `)
}

const parse = (raw) => {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/** 读取全部配置（启动时加载进内存缓存用） */
export const loadAllSettings = async (db) => {
  await ensureSettingsTable(db)
  const rows = await db.all('SELECT key, value FROM settings')
  const map = {}
  for (const row of rows) map[row.key] = parse(row.value)
  return map
}

/** 读取单个配置 */
export const getSetting = async (db, key) => {
  await ensureSettingsTable(db)
  const row = await db.get('SELECT value FROM settings WHERE key = ?', key)
  return row ? parse(row.value) : undefined
}

/** 写入/更新配置（value 序列化为 JSON 字符串） */
export const upsertSetting = async (db, key, value) => {
  await ensureSettingsTable(db)
  const raw = JSON.stringify(value)
  await db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, raw === undefined ? 'null' : raw]
  )
}
