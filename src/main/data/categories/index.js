/**
 * @file: 分类本地存储 CRUD
 */

import { v4 as uuidv4 } from 'uuid'
import { withDb } from '../dbHelper.js'

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

export const getCategories = (type) =>
  withDb('categories', ensureTable, (db) =>
    db.all('SELECT * FROM categories WHERE type = ? ORDER BY created_at ASC', type)
  )

export const addCategory = (type, name) =>
  withDb('categories', ensureTable, async (db) => {
    const id = uuidv4().replace(/-/g, '_')
    await db.run('INSERT INTO categories (id, type, name) VALUES (?, ?, ?)', [id, type, name])
    return id
  })

export const updateCategory = (id, name) =>
  withDb('categories', ensureTable, (db) =>
    db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id])
  )

export const deleteCategory = (id) =>
  withDb('categories', ensureTable, (db) => db.run('DELETE FROM categories WHERE id = ?', id))
