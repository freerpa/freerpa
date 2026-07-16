import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const CLEANUP_OVER_DAYS = 3 * 24 * 60 * 60 * 1000

/**
 * 清理超过 3 天的 Session Partitions 目录
 */
export const cleanupOldSessions = () => {
  const sessionDir = path.join(app.getPath('userData'), 'Partitions')

  if (!fs.existsSync(sessionDir)) return

  fs.readdir(sessionDir, (_error, dirs) => {
    dirs.forEach((filename) => {
      const tempDir = path.join(sessionDir, filename)
      fs.stat(tempDir, (err, stats) => {
        if (err) return
        if (Date.now() - stats.atimeMs > CLEANUP_OVER_DAYS) {
          fs.rmdir(tempDir, { recursive: true }, (err) => {
            if (err) {
              console.error('Failed to delete session directory: ', err)
            } else {
              console.log('Session directory deleted successfully')
            }
          })
        }
      })
    })
  })
}
