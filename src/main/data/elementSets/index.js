/**
 * @file: 元素集本地存储 CRUD
 * 表名使用 es_ 前缀避免与已有表冲突
 */

import { v4 as uuidv4 } from 'uuid'
import { createEntityCrud } from '../crudFactory.js'
import { withDb } from '../dbHelper.js'
import { queryPage } from '../crud.js'

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

const crud = createEntityCrud({
  table: 'es_sets',
  entityName: '元素集',
  ensureTable: ensureTables,
  keywordCols: ['title', 'description']
})

export const getElementSets = async (params) => {
  return withDb('es_sets', ensureTables, async (db) => {
    const result = await queryPage({ db, table: 'es_sets', keywordCols: ['title', 'description'], defaultOrder: 'created_at DESC', ...params })
    // 元素数量一次性批量取回（消除列表每项 N+1 查询）
    if (result.data.length > 0) {
      const ids = result.data.map((s) => s.id)
      const rows = await db.all(
        `SELECT set_id, COUNT(*) AS count FROM es_elements WHERE set_id IN (${ids.map(() => '?').join(',')}) GROUP BY set_id`,
        ids
      )
      const countMap = new Map(rows.map((r) => [r.set_id, r.count]))
      for (const set of result.data) set.elementCount = countMap.get(set.id) || 0
    }
    return result
  })
}

export const deleteElementSet = crud.del
export const getTrashElementSets = crud.trash
export const restoreElementSet = crud.restore

export const getElementSet = async (id) => {
  return withDb('es_sets', ensureTables, async (db) => {
    const set = await db.get('SELECT * FROM es_sets WHERE id = ?', id)
    if (!set) return null
    const elements = await db.all('SELECT * FROM es_elements WHERE set_id = ? ORDER BY sort_order ASC', id)
    // selectors 单次批量取回（消除每元素 N+1 查询）
    if (elements.length > 0) {
      const selectors = await db.all(
        `SELECT * FROM es_selectors WHERE element_id IN (${elements.map(() => '?').join(',')}) ORDER BY sort_order ASC`,
        elements.map((el) => el.id)
      )
      const byElement = new Map()
      for (const s of selectors) {
        if (!byElement.has(s.element_id)) byElement.set(s.element_id, [])
        byElement.get(s.element_id).push(s)
      }
      for (const el of elements) el.selectors = byElement.get(el.id) || []
    }
    set.elements = elements
    return set
  })
}

export const createElementSet = async ({ title, description, category_id, elements = [] }) => {
  return withDb('es_sets', ensureTables, async (db) => {
    const id = uuidv4().replace(/-/g, '_')

    await db.run(
      `INSERT INTO es_sets (id, category_id, title, description) VALUES (?, ?, ?, ?)`,
      [id, category_id || '', title, description || '']
    )

    for (let i = 0; i < elements.length; i++) {
      await _insertElement(db, id, elements[i], i)
    }

    return id
  })
}

export const updateElementSet = async ({ id, title, description, category_id, elements }) => {
  return withDb('es_sets', ensureTables, async (db) => {
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
  })
}

export const permanentDeleteElementSet = async (id) => {
  return withDb('es_sets', ensureTables, async (db) => {
    const oldElements = await db.all('SELECT id FROM es_elements WHERE set_id = ?', id)
    for (const el of oldElements) {
      await db.run('DELETE FROM es_selectors WHERE element_id = ?', el.id)
    }
    await db.run('DELETE FROM es_elements WHERE set_id = ?', id)
    await db.run('DELETE FROM es_sets WHERE id = ?', id)
  })
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
