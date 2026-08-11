/**
 * @file: 浏览器环境本地存储 CRUD
 */

import { createEntityCrud } from '../crudFactory.js'

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

const crud = createEntityCrud({
  table: 'browsers',
  entityName: '浏览器',
  ensureTable,
  keywordCols: ['name', 'description'],
  createCols: ['name', 'description', 'category_id', 'kernel_id', 'proxy_url', 'config'],
  updateCols: ['name', 'description', 'category_id', 'kernel_id', 'proxy_url', 'config'],
  jsonCols: ['config']
})

export const getBrowsers = crud.list
export const getBrowser = crud.get
export const createBrowser = crud.create
export const updateBrowser = crud.update
export const deleteBrowser = crud.del
export const getTrashBrowsers = crud.trash
export const restoreBrowser = crud.restore
export const permanentDeleteBrowser = crud.permanentDelete
