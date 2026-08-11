/**
 * @file: 旧配置迁移（user-preferences JSON → settings 表）
 * 一次性：启动时检测 <userData>/user-preferences 存在且 settings 表无对应键，
 * 逐键写入 DB，成功后原文件改名 .migrated（保留备份，不删除）。
 * 幂等：已迁移过的键（库内已有）跳过，不会覆盖库内新值。
 */
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { loadAllSettings, upsertSetting } from '../data/settings.js'
import { initDatabase } from '../data/db.js'

const LEGACY_FILE = 'user-preferences'

/** 执行迁移；返回是否发生了迁移 */
export const migrateLegacyPreferences = async () => {
  const file = path.join(app.getPath('userData'), LEGACY_FILE)
  if (!fs.existsSync(file)) return false

  let legacy = {}
  try {
    legacy = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    // 旧文件损坏：改名留档，不阻断启动
    try { fs.renameSync(file, file + '.migrated') } catch (_) {}
    return false
  }

  const db = await initDatabase()
  const existing = await loadAllSettings(db)
  const keys = Object.keys(legacy)
  let migrated = 0
  for (const key of keys) {
    if (!(key in existing)) {
      await upsertSetting(db, key, legacy[key])
      migrated++
    }
  }

  if (migrated > 0) {
    // 库位置固定默认路径，无需自举重开；全部落库成功后原文件留档
    fs.renameSync(file, file + '.migrated')
  }
  return migrated > 0
}
