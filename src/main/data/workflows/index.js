/**
 * @file: 工作流本地存储 CRUD
 */

import { v4 as uuidv4 } from 'uuid'
import { initDatabase } from '../db.js'
import { queryPage, softDelete, trashList, restoreRow } from '../crud.js'

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

export const getWorkflows = async (params) => {
  const db = await initDatabase()
  await ensureTable(db)
  return queryPage({ db, table: 'workflows', keywordCols: ['name', 'description'], ...params })
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
  await softDelete(db, 'workflows', id)
}

export const getTrashWorkflows = async () => {
  const db = await initDatabase()
  await ensureTable(db)
  return trashList(db, 'workflows')
}

export const restoreWorkflow = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  await restoreRow(db, 'workflows', id)
}

export const permanentDeleteWorkflow = async (id) => {
  const db = await initDatabase()
  await ensureTable(db)
  await db.run('DELETE FROM workflows WHERE id = ?', id)
}
