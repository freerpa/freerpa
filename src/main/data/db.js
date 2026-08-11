/**
 * @file: 数据库连接管理（共享单例）
 * 所有用户共享同一份本地数据；库位置固定为默认路径 <userData>/storage/database.sqlite（不支持更改）
 */

import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import { ensureSettingsTable } from './settings.js'

let db = null

/** 数据库文件路径（固定默认，不支持更改） */
export const getDbPath = () => path.join(app.getPath('userData'), 'storage', 'database.sqlite')

// 初始化数据库（共享单例）
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

  return db
}
