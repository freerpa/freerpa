/**
 * @file: 缓存管理 IPC
 * @description: 浏览器缓存大小查询 & 清空
 */
import { ipcMain, app } from 'electron'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { formatSize } from '../utils.js'

/** 递归计算目录大小（异步并行，避免同步递归阻塞主进程） */
const getDirSize = async (dirPath) => {
  let entries
  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true })
  } catch {
    return 0
  }
  const sizes = await Promise.all(
    entries.map(async (file) => {
      const fp = path.join(dirPath, file.name)
      try {
        if (file.isDirectory()) return getDirSize(fp)
        const st = await fsp.stat(fp)
        return st.size
      } catch {
        return 0
      }
    })
  )
  return sizes.reduce((sum, s) => sum + s, 0)
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
    const details = []
    for (const d of dirs) {
      const size = await getDirSize(d)
      totalSize += size
      details.push({ path: d, size, label: formatSize(size), exists: fs.existsSync(d) })
    }
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
