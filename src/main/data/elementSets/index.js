/**
 * @file: 元素集本地存储 CRUD
 * 表名使用 es_ 前缀避免与已有表冲突
 */

import { v4 as uuidv4 } from 'uuid'
import { initDatabase } from '../db.js'

const ensureTables = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS es_sets (
      id TEXT PRIMARY KEY,
      category_id TEXT DEFAULT '',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      deleted_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
      updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS es_elements (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      name TEXT NOT NULL,
      match_condition TEXT DEFAULT 'any',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS es_selectors (
      id TEXT PRIMARY KEY,
      element_id TEXT NOT NULL,
      type TEXT NOT NULL,
      text_subtype TEXT DEFAULT '',
      expression TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `)
}

// ─── 元素集 CRUD ───────────────────────────────────────

export const getElementSets = async ({ page = 1, pageSize = 24, keyword = '', category_id = '' }) => {
  const db = await initDatabase()
  await ensureTables(db)

  let whereClause = 'WHERE deleted_at IS NULL'
  const params = []
  if (keyword) {
    whereClause += ' AND (title LIKE ? OR description LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  if (category_id) {
    whereClause += ' AND category_id = ?'
    params.push(category_id)
  }

  const countResult = await db.get(`SELECT COUNT(*) as total FROM es_sets ${whereClause}`, params)
  const offset = (page - 1) * pageSize
  const data = await db.all(
    `SELECT * FROM es_sets ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )
  return { total: countResult.total, data, page, pageSize }
}

export const getElementSet = async (id) => {
  const db = await initDatabase()
  await ensureTables(db)
  const set = await db.get('SELECT * FROM es_sets WHERE id = ?', id)
  if (!set) return null
  const elements = await db.all('SELECT * FROM es_elements WHERE set_id = ? ORDER BY sort_order ASC', id)
  for (const el of elements) {
    el.selectors = await db.all('SELECT * FROM es_selectors WHERE element_id = ? ORDER BY sort_order ASC', el.id)
  }
  set.elements = elements
  return set
}

export const createElementSet = async ({ title, description, category_id, elements = [] }) => {
  const db = await initDatabase()
  await ensureTables(db)
  const id = uuidv4().replace(/-/g, '_')

  await db.run(
    `INSERT INTO es_sets (id, category_id, title, description) VALUES (?, ?, ?, ?)`,
    [id, category_id || '', title, description || '']
  )

  for (let i = 0; i < elements.length; i++) {
    await _insertElement(db, id, elements[i], i)
  }

  return id
}

export const updateElementSet = async ({ id, title, description, category_id, elements }) => {
  const db = await initDatabase()
  await ensureTables(db)
  const existing = await db.get('SELECT * FROM es_sets WHERE id = ?', id)
  if (!existing) throw new Error('元素集不存在')

  await db.run(
    `UPDATE es_sets SET title = ?, description = ?, category_id = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    [
      title !== undefined ? title : existing.title,
      description !== undefined ? description : existing.description,
      category_id !== undefined ? category_id : existing.category_id,
      id
    ]
  )

  if (elements !== undefined) {
    const oldElements = await db.all('SELECT id FROM es_elements WHERE set_id = ?', id)
    for (const el of oldElements) {
      await db.run('DELETE FROM es_selectors WHERE element_id = ?', el.id)
    }
    await db.run('DELETE FROM es_elements WHERE set_id = ?', id)

    for (let i = 0; i < elements.length; i++) {
      await _insertElement(db, id, elements[i], i)
    }
  }
}

export const deleteElementSet = async (id) => {
  const db = await initDatabase()
  await ensureTables(db)
  await db.run("UPDATE es_sets SET deleted_at = datetime('now','localtime') WHERE id = ?", id)
}

// 回收站
export const getTrashElementSets = async () => {
  const db = await initDatabase()
  await ensureTables(db)
  return db.all("SELECT * FROM es_sets WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
}

export const restoreElementSet = async (id) => {
  const db = await initDatabase()
  await ensureTables(db)
  await db.run("UPDATE es_sets SET deleted_at = NULL WHERE id = ?", id)
}

export const permanentDeleteElementSet = async (id) => {
  const db = await initDatabase()
  await ensureTables(db)
  const oldElements = await db.all('SELECT id FROM es_elements WHERE set_id = ?', id)
  for (const el of oldElements) {
    await db.run('DELETE FROM es_selectors WHERE element_id = ?', el.id)
  }
  await db.run('DELETE FROM es_elements WHERE set_id = ?', id)
  await db.run('DELETE FROM es_sets WHERE id = ?', id)
}

// ─── 内部工具 ──────────────────────────────────────────

const _insertElement = async (db, setId, element, sortOrder) => {
  const elId = uuidv4().replace(/-/g, '_')
  await db.run(
    `INSERT INTO es_elements (id, set_id, name, match_condition, sort_order) VALUES (?, ?, ?, ?, ?)`,
    [elId, setId, element.name, element.match_condition || 'any', sortOrder]
  )
  if (element.selectors && element.selectors.length > 0) {
    for (let j = 0; j < element.selectors.length; j++) {
      const sel = element.selectors[j]
      const selId = uuidv4().replace(/-/g, '_')
      await db.run(
        `INSERT INTO es_selectors (id, element_id, type, text_subtype, expression, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [selId, elId, sel.type, sel.text_subtype || '', sel.expression || '', j]
      )
    }
  }
}
