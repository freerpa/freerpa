/**
 * @file: 数据管理 IPC
 * @description: 数据库信息查询 / 打开所在目录
 */
import { ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { formatSize } from '../utils.js'
import { getDbPath } from './db.js'

const DB_PATH = () => getDbPath()
const DB_DIR = () => path.dirname(getDbPath())

export const register = () => {
  ipcMain.handle('data:getDbInfo', async () => {
    const dbPath = DB_PATH()
    let size = 0
    let exists = fs.existsSync(dbPath)
    if (exists) {
      try { size = fs.statSync(dbPath).size } catch (_) {}
    }
    return {
      path: dbPath,
      exists,
      size,
      label: formatSize(size),
      dir: DB_DIR()
    }
  })

  ipcMain.handle('data:openDbFolder', async () => {
    shell.openPath(DB_DIR())
  })
}
