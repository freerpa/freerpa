/**
 * @file: 浏览器环境本地存储 CRUD
 */

import { createEntityCrud } from '../crudFactory.js'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

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
  entityname: '网页',
  ensureTable,
  keywordCols: ['name', 'description'],
  defaultOrder: 'created_at DESC',
  createCols: ['name', 'description', 'category_id', 'kernel_id', 'proxy_url', 'config'],
  updateCols: ['name', 'description', 'category_id', 'kernel_id', 'proxy_url', 'config'],
  jsonCols: ['config']
})

export const getBrowsers = crud.list
export const getBrowser = crud.get
export const createBrowser = crud.create
export const updateBrowser = crud.update

/** 浏览器会话用户目录路径：userData/sessions/<id>（与浏览器启动时 userDataDir 对应） */
const getSessionDir = (id) => path.join(app.getPath('userData'), 'sessions', String(id))

/** 删除浏览器时同步删除其 session 用户目录（登录态/cookie/缓存一并清除） */
const removeSessionDir = (id) => {
  try {
    fs.rmSync(getSessionDir(id), { recursive: true, force: true })
  } catch (e) {
    // 目录不存在或已被占用时忽略（force 已兜底大部分场景）
    console.warn(`清理浏览器 session 目录失败: ${id}`, e?.message || e)
  }
}

/** 删除（移入回收站）时清理 session 目录 */
export const deleteBrowser = async (id) => {
  await crud.del(id)
  removeSessionDir(id)
}

export const getTrashBrowsers = crud.trash
export const restoreBrowser = crud.restore

/** 永久删除时再次确保 session 目录已清理 */
export const permanentDeleteBrowser = async (id) => {
  await crud.permanentDelete(id)
  removeSessionDir(id)
}
