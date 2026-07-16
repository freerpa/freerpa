/**
 * @file: 数据库连接管理（共享单例）
 * 所有用户共享同一份本地数据
 */

import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

let db = null

// 初始化数据库（固定路径，不区分用户）
export const initDatabase = async () => {
  if (db?.db?.open) return db

  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'storage')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  const dbPath = path.join(dbDir, 'database.sqlite')

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  })

  return db
}
