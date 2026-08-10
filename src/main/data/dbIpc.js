/**
 * @file: 数据管理 IPC
 * @description: 数据库信息查询 / 备份 / 恢复 / 更换存储位置
 */
import { ipcMain, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { formatSize } from '../utils.js'
import { getDbPath, writeDbLocation } from './db.js'
import { set, flush } from '../store/index.js'

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

  ipcMain.handle('data:changeDbLocation', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择新的数据库存储目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths?.length) return { canceled: true }
    const newDir = result.filePaths[0]
    const oldPath = DB_PATH()
    const newPath = path.join(newDir, 'database.sqlite')

    if (newPath === oldPath) return { canceled: false, same: true }

    // 目标已存在则拒绝（防止覆盖既有库）
    if (fs.existsSync(newPath)) {
      return { error: '目标目录已存在 database.sqlite，请选择空目录或先备份' }
    }
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true })
    }

    // 1. 先把新路径写入当前库（新库副本因此自带 dbPath 覆盖，重启自举可读）
    set('dbPath', newPath)
    await flush()

    // 2. 复制到新位置（含 settings.dbPath），再移除旧库（移动语义）
    if (fs.existsSync(oldPath)) {
      fs.copyFileSync(oldPath, newPath)
      fs.unlinkSync(oldPath)
    }

    // 3. 引导定位文件兜底：默认库被移除后，重启自举仍能找到新库
    writeDbLocation(newPath)
    return { success: true, newPath }
  })

  ipcMain.handle('data:backupDb', async () => {
    const oldPath = DB_PATH()
    if (!fs.existsSync(oldPath)) {
      return { error: '数据库文件不存在' }
    }
    const result = await dialog.showSaveDialog({
      title: '选择备份位置',
      defaultPath: `database-backup-${new Date().toISOString().slice(0, 10)}.sqlite`,
      filters: [{ name: 'SQLite 数据库', extensions: ['sqlite', 'db'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    fs.copyFileSync(oldPath, result.filePath)
    return { success: true, backupPath: result.filePath }
  })

  ipcMain.handle('data:restoreDb', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择备份文件',
      filters: [{ name: 'SQLite 数据库', extensions: ['sqlite', 'db'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths?.length) return { canceled: true }

    const backupPath = result.filePaths[0]
    const targetPath = DB_PATH()

    // 备份当前数据库
    const tempBackup = targetPath + '.before-restore.bak'
    if (fs.existsSync(targetPath)) {
      fs.copyFileSync(targetPath, tempBackup)
    }

    try {
      fs.copyFileSync(backupPath, targetPath)
      return { success: true, needRestart: true }
    } catch (e) {
      // 恢复旧文件
      if (fs.existsSync(tempBackup)) {
        fs.copyFileSync(tempBackup, targetPath)
        fs.unlinkSync(tempBackup)
      }
      return { error: '恢复失败: ' + e.message }
    }
  })

  ipcMain.handle('data:openDbFolder', async () => {
    shell.openPath(DB_DIR())
  })
}
