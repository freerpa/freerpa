/**
 * @file: 工作流本地存储 CRUD
 */

import { createEntityCrud } from '../crudFactory.js'

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

const crud = createEntityCrud({
  table: 'workflows',
  entityName: '工作流',
  ensureTable,
  keywordCols: ['name', 'description'],
  defaultOrder: 'created_at DESC',
  createCols: ['name', 'description', 'category_id', 'graph'],
  updateCols: ['name', 'description', 'category_id', 'graph'],
  jsonCols: ['graph'],
  jsonDefaults: { graph: { nodes: [], edges: [] } }
})

export const getWorkflows = crud.list
export const getWorkflow = crud.get
export const createWorkflow = crud.create
export const updateWorkflow = crud.update
export const deleteWorkflow = crud.del
export const getTrashWorkflows = crud.trash
export const restoreWorkflow = crud.restore
export const permanentDeleteWorkflow = crud.permanentDelete
