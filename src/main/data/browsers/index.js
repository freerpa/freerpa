/**
 * @file: 浏览器环境本地存储 CRUD
 */

import { v4 as uuidv4 } from 'uuid'
import { initDatabase } from '../db.js'
import { queryPage, softDelete, trashList, restoreRow } from '../crud.js'

const ensureTable = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS browsers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category_id TEXT DEFAULT '',
      kernel_id TEXT DEFAULT '',
      proxy_url TEXT DEFAULT '',
      config TEXT NOT NULL DEFAULT '{}',
      deleted_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
      updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `)
  try { await db.exec(`ALTER TABLE browsers ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL`) } catch (e) {}
}

export const getBrowsers = async (params) => {
  const db = await initDatabase()
  await ensureTable(db)
  return queryPage({ db, table: 'browsers', keywordCols: ['name', 'description'], ...params })
}

export const getBrowser = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  return db.get('SELECT * FROM browsers WHERE id = ?', id)
}

export const createBrowser = async ({ name, description, category_id, kernel_id, proxy_url, config }) => {
  const db = await initDatabase()
  await ensureTable(db)
  const id = uuidv4().replace(/-/g, '_')
  await db.run(
    `INSERT INTO browsers (id, name, description, category_id, kernel_id, proxy_url, config) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description || '', category_id || '', kernel_id || '', proxy_url || '', JSON.stringify(config || {})]
  )
  return id
}

export const updateBrowser = async ({ id, name, description, category_id, kernel_id, proxy_url, config }) => {
  const db = await initDatabase()
  await ensureTable(db)
  // 先获取现有数据，实现部分更新
  const existing = await db.get('SELECT * FROM browsers WHERE id = ?', id)
  if (!existing) throw new Error('浏览器不存在')
  await db.run(
    `UPDATE browsers SET name = ?, description = ?, category_id = ?, kernel_id = ?, proxy_url = ?, config = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    [
      name !== undefined ? name : existing.name,
      description !== undefined ? description : existing.description,
      category_id !== undefined ? category_id : existing.category_id,
      kernel_id !== undefined ? kernel_id : existing.kernel_id,
      proxy_url !== undefined ? proxy_url : existing.proxy_url,
      config !== undefined ? JSON.stringify(config) : existing.config,
      id
    ]
  )
}

export const deleteBrowser = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  await softDelete(db, 'browsers', id)
}

export const getTrashBrowsers = async () => {
  const db = await initDatabase()
  await ensureTable(db)
  return trashList(db, 'browsers')
}

export const restoreBrowser = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  await restoreRow(db, 'browsers', id)
}

export const permanentDeleteBrowser = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  await db.run('DELETE FROM browsers WHERE id = ?', id)
}
