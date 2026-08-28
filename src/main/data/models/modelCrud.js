/**
 * @file: 模型元数据 CRUD（models 表：模型定义本身，不含数据行）
 * 负责：模型表结构、创建/更新/删除/复制模型、回收站
 */
import { v4 as uuidv4 } from 'uuid'
import { queryPage } from '../crud.js'
import { createEntityCrud } from '../crudFactory.js'
import { withDb } from '../dbHelper.js'
import { generateCreateTableSQL, getColumnType, invalidateModelFields } from './queryUtils.js'

// 创建模型表
const ensureModelsTable = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category_id TEXT DEFAULT '',
      fields TEXT NOT NULL,
      deleted_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
      updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `)
  // 兼容旧表（列已存在时 ALTER 失败，忽略即可）
  try { await db.exec(`ALTER TABLE models ADD COLUMN category_id TEXT DEFAULT ''`) } catch { /* 忽略 */ }
  try { await db.exec(`ALTER TABLE models ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL`) } catch { /* 忽略 */ }
  try { await db.exec(`ALTER TABLE models ADD COLUMN updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))`) } catch { /* 忽略 */ }
}

// 获取模型
export const getModel = (id) =>
  withDb('models', ensureModelsTable, (db) => db.get('SELECT * FROM models WHERE id = ?', id))

// 获取所有模型
export const getModels = (params) =>
  withDb('models', ensureModelsTable, async (db) => {
    const result = await queryPage({ db, table: 'models', keywordCols: ['name', 'description'], defaultOrder: 'created_at DESC', pageSize: 8, ...params })

    // 数据量统计：单次 UNION ALL 批量取回（消除每模型 N+1 查询）
    const ids = result.data.map((m) => m.id)
    const counts = {}
    if (ids.length > 0) {
      const tables = await db.all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'model_data_%'`)
      const existing = new Set(tables.map((t) => t.name))
      // 模型 id 由 uuid 去横线生成（仅含字母数字下划线），可直接作为表名/别名安全拼接
      const countSql = ids
        .filter((id) => existing.has(`model_data_${id}`))
        .map((id) => `SELECT '${id}' AS id, COUNT(*) AS count FROM model_data_${id}`)
        .join(' UNION ALL ')
      if (countSql) {
        const rows = await db.all(countSql)
        for (const row of rows) counts[row.id] = row.count
      }
    }

    for (const model of result.data) {
      model.data_count = counts[model.id] || 0

      const fields = JSON.parse(model.fields)
      model.field_stats = {
        total: fields.length,
        required: fields.filter((f) => f.required).length,
        unique: fields.filter((f) => f.unique).length,
        types: fields.reduce((acc, f) => {
          acc[f.type] = (acc[f.type] || 0) + 1
          return acc
        }, {})
      }
    }

    return result
  })

// 创建模型
export const createModel = ({ name, description, category_id, fields }) =>
  withDb('models', ensureModelsTable, async (db) => {
    const id = uuidv4().replace(/-/g, '_')

    fields = fields.map((field, index) => ({ ...field, sort: index }))

    await db.run('BEGIN TRANSACTION')
    try {
      await db.run(`INSERT INTO models (id, name, description, category_id, fields) VALUES (?, ?, ?, ?, ?)`, [
        id, name, description, category_id || '', JSON.stringify(fields)
      ])
      await db.exec(generateCreateTableSQL(id, fields))
      for (const field of fields) {
        if (field.unique) {
          await db.exec(`CREATE UNIQUE INDEX idx_${id}_${field.name} ON model_data_${id} (${field.name})`)
        }
      }
      await db.run('COMMIT')
      return id
    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }
  })

// 更新模型
export const updateModel = ({ id, name, description, category_id, fields }) =>
  withDb('models', ensureModelsTable, async (db) => {
    const model = await db.get('SELECT fields FROM models WHERE id = ?', id)
    if (!model) throw new Error('模型不存在')

    const tableName = `model_data_${id}`
    const hasData = await db.get(`SELECT COUNT(*) as count FROM ${tableName}`)
    const hasExistingData = hasData.count > 0

    if (hasExistingData) {
      const oldFields = JSON.parse(model.fields)
      const oldFieldNames = oldFields.map((f) => f.name).sort().join(',')
      const newFieldNames = fields.map((f) => f.name).sort().join(',')
      if (oldFieldNames !== newFieldNames) throw new Error('模型已有数据，不能修改字段结构')
      const oldFieldMap = Object.fromEntries(oldFields.map((f) => [f.name, f.type]))
      const hasTypeChange = fields.some((f) => oldFieldMap[f.name] !== f.type)
      if (hasTypeChange) throw new Error('模型已有数据，不能修改字段类型')
    }

    await db.run('BEGIN TRANSACTION')
    try {
      await db.run(
        `UPDATE models SET name = ?, description = ?, category_id = ?, fields = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, description, category_id || '', JSON.stringify(fields), id]
      )
      if (!hasExistingData) {
        await db.run(`DROP TABLE IF EXISTS ${tableName}`)
        await db.exec(generateCreateTableSQL(id, fields))
        for (const field of fields) {
          if (field.unique) {
            await db.exec(`CREATE UNIQUE INDEX idx_${id}_${field.name} ON ${tableName} (${field.name})`)
          }
        }
      }
      await db.run('COMMIT')
    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }
    // 字段结构已更新：失效该模型的字段解析缓存
    invalidateModelFields(id)
  })

// 删除模型（软删除/回收站/恢复：通用八件套，复用 crudFactory）
const crud = createEntityCrud({ table: 'models', entityName: '模型', ensureTable: ensureModelsTable })
export const deleteModel = crud.del
export const getTrashModels = crud.trash
export const restoreModel = crud.restore

export const permanentDeleteModel = (id) =>
  withDb('models', ensureModelsTable, async (db) => {
    await db.run(`DROP TABLE IF EXISTS model_data_${id}`)
    await db.run('DELETE FROM models WHERE id = ?', id)
    invalidateModelFields(id)
  })

// 复制模型
export const copyModel = (id, newName) =>
  withDb('models', ensureModelsTable, async (db) => {
    const model = await db.get('SELECT * FROM models WHERE id = ?', id)
    if (!model) throw new Error('模型不存在')

    const newId = uuidv4().replace(/-/g, '_')
    const name = newName || `${model.name} - 副本`

    await db.run('BEGIN TRANSACTION')
    try {
      const fields = JSON.parse(model.fields)
      await db.run(
        `INSERT INTO models (id, name, description, fields) VALUES (?, ?, ?, ?)`,
        [newId, name, model.description, JSON.stringify(fields)]
      )
      const columns = fields
        .map((field) =>
          `${field.name} ${getColumnType(field)} ${field.required ? 'NOT NULL' : ''} DEFAULT NULL`
        )
        .join(',')
      await db.exec(`
        CREATE TABLE model_data_${newId} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          color TEXT,
          ${columns},
          created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
        )
      `)
      for (const field of fields) {
        if (field.unique) {
          await db.exec(`CREATE UNIQUE INDEX idx_${newId}_${field.name} ON model_data_${newId} (${field.name})`)
        }
      }
      await db.run('COMMIT')
      return newId
    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }
  })
