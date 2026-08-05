/**
 * @file: data 层公共 SQL 助手 — 消除各子模块 CRUD 重复
 */

/** 分页列表查询（软删除排除 + keyword/category 过滤） */
export const queryPage = async ({ db, table, keywordCols = [], defaultOrder = 'updated_at DESC', keyword = '', category_id = '', page = 1, pageSize = 24 }) => {
  let whereClause = 'WHERE deleted_at IS NULL'
  const params = []
  if (keyword) {
    whereClause += ` AND (${keywordCols.map((c) => `${c} LIKE ?`).join(' OR ')})`
    params.push(...keywordCols.map(() => `%${keyword}%`))
  }
  if (category_id) {
    whereClause += ' AND category_id = ?'
    params.push(category_id)
  }

  const countResult = await db.get(`SELECT COUNT(*) as total FROM ${table} ${whereClause}`, params)
  const offset = (page - 1) * pageSize
  const data = await db.all(
    `SELECT * FROM ${table} ${whereClause} ORDER BY ${defaultOrder} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )
  return { total: countResult.total, data, page, pageSize }
}

/** 软删除（移入回收站） */
export const softDelete = async (db, table, id) => {
  await db.run(`UPDATE ${table} SET deleted_at = datetime('now','localtime') WHERE id = ?`, id)
}

/** 回收站列表 */
export const trashList = async (db, table) => {
  return db.all(`SELECT * FROM ${table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
}

/** 从回收站恢复 */
export const restoreRow = async (db, table, id) => {
  await db.run(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?`, id)
}
