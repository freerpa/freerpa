/**
 * @file: 数据库连接管理（共享单例）
 * 所有用户共享同一份本地数据
 */

import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import { get } from '../store/index.js'

let db = null

/** 数据库文件路径（可从 store 覆盖：更换存储位置后重启生效） */
export const getDbPath = () =>
  get('dbPath') || path.join(app.getPath('userData'), 'storage', 'database.sqlite')

// 初始化数据库
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

  return db
}
