/**
 * @file: 数据库连接管理（共享单例）
 * 所有用户共享同一份本地数据
 */

import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import { get, set } from '../store/index.js'
import { ensureSettingsTable, getSetting } from './settings.js'

let db = null

/** 引导定位文件：默认库被移动后重启自举的依据（仅存一行库路径，非配置数据） */
const getLocationFile = () => path.join(app.getPath('userData'), 'storage', 'db.location')

const readDbLocation = () => {
  try {
    return fs.readFileSync(getLocationFile(), 'utf8').trim() || null
  } catch {
    return null
  }
}

/** 写入库路径定位文件（幂等；失败不影响主流程） */
export const writeDbLocation = (dbPath) => {
  try {
    const f = getLocationFile()
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(f, dbPath)
  } catch {
    /* 指针写入失败：仍有库内 settings.dbPath 与默认路径两条自举路径 */
  }
}

/**
 * 数据库文件路径，优先级：
 *  1. 内存缓存（store.dbPath，运行时覆盖）
 *  2. 引导定位文件（db.location，默认库被移动后）
 *  3. 默认路径 <userData>/storage/database.sqlite
 */
export const getDbPath = () => get('dbPath') || readDbLocation() || path.join(app.getPath('userData'), 'storage', 'database.sqlite')

// 初始化数据库（含 dbPath 自举：库内 settings.dbPath 覆盖默认路径 → 自动切换到覆盖库）
export const initDatabase = async () => {
  if (db?.db?.open) return db

  const dbPath = getDbPath()
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  })

  // 配置表（store 依赖，随库初始化确保存在）
  await ensureSettingsTable(db)

  // 自举：settings.dbPath 与当前打开路径不一致 → 同步缓存、写定位文件并切换到覆盖库（最多一次）
  const storedDbPath = await getSetting(db, 'dbPath')
  if (storedDbPath && storedDbPath !== dbPath) {
    await db.close()
    db = null
    // 仅更新内存缓存与定位文件（此时 dbRef 未设，set 不写库；值本身来自库内）
    set('dbPath', storedDbPath)
    writeDbLocation(storedDbPath)
    return initDatabase()
  }

  return db
}

/** 关闭数据库连接（供自举切库/运维使用） */
export const closeDatabase = async () => {
  if (db?.db?.open) {
    await db.close()
  }
  db = null
}
