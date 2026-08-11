/**
 * @file: data 层 withDb 助手 — 统一 initDatabase + ensureTable 样板，并缓存建表结果
 * 缓存以 db 实例为键（WeakMap）：切库（closeDatabase → 新实例）后自动失效重建，避免漏建表
 */
import { initDatabase } from './db.js'

const ensured = new WeakMap()

export const withDb = async (table, ensureTableFn, fn) => {
  const db = await initDatabase()
  let set = ensured.get(db)
  if (!set?.has(table)) {
    await ensureTableFn(db)
    if (!set) {
      set = new Set()
      ensured.set(db, set)
    }
    set.add(table)
  }
  return fn(db)
}
