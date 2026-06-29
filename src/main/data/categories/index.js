/**
 * @file: 分类本地存储 CRUD
 */

import { v4 as uuidv4 } from 'uuid'
import { initDatabase } from '../db.js'

const ensureTable = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `)
}

export const getCategories = async (type) => {
  const db = await initDatabase()
  await ensureTable(db)
  return db.all('SELECT * FROM categories WHERE type = ? ORDER BY created_at ASC', type)
}

export const addCategory = async (type, name) => {
  const db = await initDatabase()
  await ensureTable(db)
  const id = uuidv4().replace(/-/g, '_')
  await db.run('INSERT INTO categories (id, type, name) VALUES (?, ?, ?)', [id, type, name])
  return id
}

export const updateCategory = async (id, name) => {
  const db = await initDatabase()
  await ensureTable(db)
  await db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id])
}

export const deleteCategory = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  await db.run('DELETE FROM categories WHERE id = ?', id)
}
