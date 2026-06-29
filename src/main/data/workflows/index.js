/**
 * @file: 工作流本地存储 CRUD
 */

import { v4 as uuidv4 } from 'uuid'
import { initDatabase } from '../db.js'

const ensureTable = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category_id TEXT DEFAULT '',
      graph TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
      deleted_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
      updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `)
  try { await db.exec(`ALTER TABLE workflows ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL`) } catch (e) {}
}

export const getWorkflows = async ({ page = 1, pageSize = 24, keyword = '', category_id = '' }) => {
  const db = await initDatabase()
  await ensureTable(db)

  let whereClause = 'WHERE deleted_at IS NULL'
  const params = []
  if (keyword) { whereClause += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }
  if (category_id) { whereClause += ' AND category_id = ?'; params.push(category_id) }

  const countResult = await db.get(`SELECT COUNT(*) as total FROM workflows ${whereClause}`, params)
  const offset = (page - 1) * pageSize
  const data = await db.all(
    `SELECT * FROM workflows ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )
  return { total: countResult.total, data, page, pageSize }
}

export const getWorkflow = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  return db.get('SELECT * FROM workflows WHERE id = ?', id)
}

export const createWorkflow = async ({ name, description, category_id, graph }) => {
  const db = await initDatabase()
  await ensureTable(db)
  const id = uuidv4().replace(/-/g, '_')
  await db.run(
    `INSERT INTO workflows (id, name, description, category_id, graph) VALUES (?, ?, ?, ?, ?)`,
    [id, name, description || '', category_id || '', JSON.stringify(graph || { nodes: [], edges: [] })]
  )
  return id
}

export const updateWorkflow = async ({ id, name, description, category_id, graph }) => {
  const db = await initDatabase()
  await ensureTable(db)
  const existing = await db.get('SELECT * FROM workflows WHERE id = ?', id)
  if (!existing) throw new Error('工作流不存在')
  await db.run(
    `UPDATE workflows SET name = ?, description = ?, category_id = ?, graph = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    [
      name !== undefined ? name : existing.name,
      description !== undefined ? description : existing.description,
      category_id !== undefined ? category_id : existing.category_id,
      graph !== undefined ? JSON.stringify(graph) : existing.graph,
      id
    ]
  )
}

export const deleteWorkflow = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  // 软删除
  await db.run("UPDATE workflows SET deleted_at = datetime('now','localtime') WHERE id = ?", id)
}

export const getTrashWorkflows = async () => {
  const db = await initDatabase()
  await ensureTable(db)
  return db.all("SELECT * FROM workflows WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
}

export const restoreWorkflow = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  await db.run("UPDATE workflows SET deleted_at = NULL WHERE id = ?", id)
}

export const permanentDeleteWorkflow = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  await db.run('DELETE FROM workflows WHERE id = ?', id)
}

export const importWorkflow = async ({ name, description, category_id, graph }) => {
  return createWorkflow({ name, description, category_id, graph })
}

export const exportWorkflow = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  return db.get('SELECT * FROM workflows WHERE id = ?', id)
}
