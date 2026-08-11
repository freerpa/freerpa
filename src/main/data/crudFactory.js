/**
 * @file: data 子域 CRUD 工厂 — 收敛 {browsers,workflows,elementSets,models} 的八件套样板
 * 各子域仅需提供：表名、实体名、建表函数、create/update 列、keyword 列、JSON 列
 * 返回 { list, get, create, update, del, trash, restore, permanentDelete }
 */
import { v4 as uuidv4 } from 'uuid'
import { withDb } from './dbHelper.js'
import { queryPage, softDelete, trashList, restoreRow } from './crud.js'

export const createEntityCrud = ({
  table,
  entityName,
  ensureTable,
  keywordCols = ['name', 'description'],
  createCols = [],
  updateCols = [],
  jsonCols = [],
  jsonDefaults = {},
  defaultOrder = 'updated_at DESC',
  defaultPageSize = 24
}) => {
  const withTable = (fn) => withDb(table, ensureTable, fn)
  // JSON 列序列化；缺省：JSON 列 → jsonDefaults[col] ?? {}，其余 → ''
  const serialize = (col, v) => {
    if (v === undefined) return jsonCols.includes(col) ? JSON.stringify(jsonDefaults[col] ?? {}) : ''
    return jsonCols.includes(col) ? JSON.stringify(v) : v
  }

  return {
    list: (params) =>
      withTable((db) =>
        queryPage({ db, table, keywordCols, defaultOrder, pageSize: defaultPageSize, ...params })
      ),

    get: (id) => withTable((db) => db.get(`SELECT * FROM ${table} WHERE id = ?`, id)),

    create: (payload) =>
      withTable(async (db) => {
        const id = uuidv4().replace(/-/g, '_')
        const values = createCols.map((col) => serialize(col, payload[col]))
        await db.run(
          `INSERT INTO ${table} (id, ${createCols.join(', ')}) VALUES (${['?', ...createCols.map(() => '?')].join(', ')})`,
          [id, ...values]
        )
        return id
      }),

    update: (payload) =>
      withTable(async (db) => {
        const { id } = payload
        const existing = await db.get(`SELECT * FROM ${table} WHERE id = ?`, id)
        if (!existing) throw new Error(`${entityName}不存在`)
        const sets = updateCols.map((col) => ({
          col,
          v: payload[col] === undefined ? existing[col] : serialize(col, payload[col])
        }))
        await db.run(
          `UPDATE ${table} SET ${sets.map((s) => `${s.col} = ?`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = ?`,
          [...sets.map((s) => s.v), id]
        )
      }),

    del: (id) => withTable((db) => softDelete(db, table, id)),

    trash: () => withTable((db) => trashList(db, table)),

    restore: (id) => withTable((db) => restoreRow(db, table, id)),

    permanentDelete: (id) => withTable((db) => db.run(`DELETE FROM ${table} WHERE id = ?`, id))
  }
}
