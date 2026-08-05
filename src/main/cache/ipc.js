/**
 * @file: 缓存管理 IPC
 * @description: 浏览器缓存大小查询 & 清空
 */
import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { formatSize } from '../utils.js'

/** 递归计算目录大小 */
const getDirSize = (dirPath) => {
  if (!fs.existsSync(dirPath)) return 0
  let size = 0
  const files = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const file of files) {
    const fp = path.join(dirPath, file.name)
    try {
      if (file.isDirectory()) {
        size += getDirSize(fp)
      } else {
        size += fs.statSync(fp).size
      }
    } catch (_) {}
  }
  return size
}

/** 递归删除目录 */
const removeDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) return
  fs.rmSync(dirPath, { recursive: true, force: true })
}

export const register = () => {
  ipcMain.handle('cache:getSize', async () => {
    const userData = app.getPath('userData')
    const dirs = [
      path.join(userData, 'sessions'),
      path.join(userData, 'kernels'),
      path.join(userData, 'Partitions')
    ]
    let totalSize = 0
    const details = dirs.map((d) => {
      const size = getDirSize(d)
      totalSize += size
      return { path: d, size, label: formatSize(size), exists: fs.existsSync(d) }
    })
    return { totalSize, label: formatSize(totalSize), details }
  })

  ipcMain.handle('cache:clear', async () => {
    const userData = app.getPath('userData')
    const dirs = [
      path.join(userData, 'sessions'),
      path.join(userData, 'kernels'),
      path.join(userData, 'Partitions')
    ]
    for (const d of dirs) {
      removeDir(d)
    }
    return { success: true }
  })
}
