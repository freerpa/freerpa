/**
 * @file: 应用配置存储模块（DB 后端）
 * 持久化到 SQLite settings 表（替代原 <userData>/user-preferences JSON 文件），
 * 业务调用方仍通过同步 get(key)/set(key) 薄接口访问，无需改动。
 * 启动时序：bootstrap 在 createWindow 前 await initDatabase() → store.load(db)；
 * 退出前 await flush() 确保未落库写入完成。
 */
import { loadAllSettings, upsertSetting } from '../data/settings.js'

let cache = {}
let dbRef = null
let pending = Promise.resolve()
// 短窗口批量写：合并高频配置写（权限/插件目录等），同 key 只落最后一次值
let writeMap = new Map()
let writeTimer = null
const WRITE_WINDOW_MS = 50

/** 从数据库加载全部配置到内存缓存（启动时调用；dbRef 由本次设置） */
export const load = async (db) => {
  dbRef = db
  cache = await loadAllSettings(db)
  return cache
}

/** 读取配置（同步，读内存缓存） */
export const get = (key) => {
  return cache[key]
}

/** 写入配置：更新内存缓存 + 异步串行写库（短窗口合并，队列防止并发覆盖） */
export const set = (key, value) => {
  cache[key] = value
  if (dbRef) {
    writeMap.set(key, value)
    if (!writeTimer) {
      writeTimer = setTimeout(flushPending, WRITE_WINDOW_MS)
    }
  }
  return value
}

const flushPending = () => {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  const batch = writeMap
  writeMap = new Map()
  if (batch.size === 0) return
  const entries = [...batch.entries()]
  pending = pending.then(async () => {
    for (const [k, v] of entries) await upsertSetting(dbRef, k, v)
  }).catch(() => {})
}

/** 等待所有未落库写入完成（退出/重启前调用） */
export const flush = () => {
  if (writeTimer) flushPending()
  return pending
}
