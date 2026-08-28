/**
 * @file: 数据模型 CRUD
 */

import { v4 as uuidv4 } from 'uuid'
import ExcelJS from 'exceljs'
import { initDatabase } from '../db.js'
import { queryPage } from '../crud.js'
import { createEntityCrud } from '../crudFactory.js'
import { withDb } from '../dbHelper.js'

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

// 生成建表SQL
const generateCreateTableSQL = (id, fields) => {
  const fieldDefinitions = fields.map((field) => {
    let def = `${field.name} ${getColumnType(field)}`
    if (field.required) def += ' NOT NULL'
    if (field.unique) def += ' UNIQUE'
    return def
  })
  return `
    CREATE TABLE model_data_${id} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      color TEXT DEFAULT NULL,
      ${fieldDefinitions.join(',\n      ')},
      created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `
}

const getColumnType = (field) => {
  switch (field.type) {
    case 'number': return 'REAL'
    default: return 'TEXT'
  }
}

// ═══════════ 模型字段解析缓存 ═══════════
// 消除 createModelData/updateModelData/deleteModelData/clearModelData/batchCreateModelData 的重复样板
// （每处都是 db.get('SELECT * FROM models') + JSON.parse(model.fields)）。
// 缓存以 db 实例为键（db 为应用共享单例，Map 不会随连接重建而泄漏——重建时 initDatabase 返回新实例即可自然隔离），
// 模型结构变更（update/permanentDelete）时按 modelId 失效。
const fieldsCache = new Map()

/** 读取并解析模型字段（带缓存）；模型不存在抛错 */
const getModelFields = async (db, modelId) => {
  const cache = fieldsCache.get(db)
  if (cache?.has(modelId)) return cache.get(modelId)
  const model = await db.get('SELECT * FROM models WHERE id = ?', modelId)
  if (!model) throw new Error('模型不存在')
  const fields = JSON.parse(model.fields)
  let entry = fieldsCache.get(db)
  if (!entry) {
    entry = new Map()
    fieldsCache.set(db, entry)
  }
  entry.set(modelId, fields)
  return fields
}

/** 模型结构变更后失效对应缓存 */
const invalidateModelFields = (modelId) => {
  for (const cache of fieldsCache.values()) cache.delete(modelId)
}

/** 字段数组 → { name: field } 索引（消除 batchCreate/update 内层线性 find） */
const indexFieldsByName = (fields) => new Map(fields.map((f) => [f.name, f]))


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

// === 模型数据 CRUD ===

const convertDataType = (value, fieldType) => {
  switch (fieldType) {
    case 'number': {
      // Number(value) 对非法输入返回 NaN 而非抛错，需显式判断
      const num = Number(value)
      return Number.isFinite(num) ? num : 0
    }
    case 'date': {
      const date = new Date(value)
      return Number.isNaN(date.getTime())
        ? new Date().toLocaleString('sv-SE').substring(0, 10)
        : date.toLocaleString('sv-SE').substring(0, 10)
    }
    default: return value
  }
}

const getWhereClause = (condition) => {
  const { field, operator, value } = condition
  if (!field || !operator || value === undefined) return { whereClause: '', params: [] }
  let whereClause = ''
  let params = []
  switch (operator) {
    case 'eq': whereClause += ` ${field} = ?`; params.push(value); break
    case 'ne': whereClause += ` ${field} != ?`; params.push(value); break
    case 'gt': whereClause += ` ${field} > ?`; params.push(value); break
    case 'gte': whereClause += ` ${field} >= ?`; params.push(value); break
    case 'lt': whereClause += ` ${field} < ?`; params.push(value); break
    case 'lte': whereClause += ` ${field} <= ?`; params.push(value); break
    case 'like': whereClause += ` ${field} LIKE ?`; params.push(`%${value}%`); break
    case 'notLike': whereClause += ` ${field} NOT LIKE ?`; params.push(`%${value}%`); break
    case 'in':
      if (typeof value === 'string' && value.includes(',')) {
        const [min, max] = value.split(',')
        whereClause += ` ${field} BETWEEN ? AND ?`; params.push(min, max)
      } else if (Array.isArray(value)) {
        whereClause += ` ${field} IN (${value.map(() => '?').join(',')})`; params.push(...value)
      } else { whereClause += ` ${field} IN (?)`; params.push(value) }
      break
    case 'notIn':
      if (typeof value === 'string' && value.includes(',')) {
        const [min, max] = value.split(',')
        whereClause += ` ${field} NOT BETWEEN ? AND ?`; params.push(min, max)
      } else if (Array.isArray(value)) {
        whereClause += ` ${field} NOT IN (${value.map(() => '?').join(',')})`; params.push(...value)
      } else { whereClause += ` ${field} NOT IN (?)`; params.push(value) }
      break
    case 'isNull': whereClause += ` (${field} IS NULL OR ${field} = '')`; break
    case 'isNotNull': whereClause += ` ${field} IS NOT NULL AND ${field} != ''`; break
  }
  return { whereClause, params }
}

export const getModelData = async ({ modelId, page = 1, pageSize = 10, filters = {}, conditions = [], sort = null, readFields = [] }) => {
  const db = await initDatabase()
  const tableName = `model_data_${modelId}`
  try {
    let whereClause = 'WHERE 1=1'
    const params = []

    Object.entries(filters).forEach(([field, condition]) => {
      if (condition && condition.operator) {
        const { operator, value } = condition
        const { whereClause: cw, params: cp } = getWhereClause({ field, operator, value })
        if (cw) { whereClause += ' AND ' + cw; params.push(...cp) }
      }
    })

    conditions.forEach((group) => {
      const groupWhereClause = []
      const { logic, conditions: groupConditions } = group
      groupConditions.forEach((condition) => {
        const { whereClause: cw, params: cp } = getWhereClause(condition)
        if (cw) { groupWhereClause.push(cw); params.push(...cp) }
      })
      if (groupWhereClause.length > 0) {
        if (logic === 'and') whereClause += ' AND (' + groupWhereClause.join(' AND ') + ')'
        else whereClause += ' AND (' + groupWhereClause.join(' OR ') + ')'
      }
    })

    let orderClause = ''
    if (sort && sort.length > 0) {
      orderClause = ` ORDER BY`
      sort.forEach((item) => {
        if (item.field) orderClause += ` ${item.field}`
        if (item.order) orderClause += ` ${item.order.toUpperCase()}`
      })
    }

    const countResult = await db.get(`SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`, params)
    const offset = (page - 1) * pageSize
    const data = await db.all(
      `SELECT ${readFields.join(', ') || '*'} FROM ${tableName} ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )
    // sort 在副本上进行，不污染缓存（缓存保持模型定义原序）
    const fields = (await getModelFields(db, modelId)).slice().sort((a, b) => a.sort - b.sort)

    return { total: countResult.total, data, fields, page, pageSize }
  } catch (error) {
    throw new Error('获取数据失败:' + error.message)
  }
}

export const createModelData = async ({ modelId, data }) => {
  const db = await initDatabase()
  const fields = await getModelFields(db, modelId)
  const tableName = `model_data_${modelId}`
  const fieldMap = indexFieldsByName(fields)
  const fieldNames = fields.map((f) => f.name)
  const placeholders = fieldNames.map(() => '?')
  const values = fieldNames.map((name) => convertDataType(data[name], fieldMap.get(name).type))
  const result = await db.run(
    `INSERT INTO ${tableName} (${fieldNames.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values
  )
  return result.lastID
}

export const updateModelData = async ({ modelId, ids, data }) => {
  const db = await initDatabase()
  const fields = await getModelFields(db, modelId)
  const tableName = `model_data_${modelId}`
  const fieldMap = indexFieldsByName(fields)
  const updates = []
  const values = []
  for (const [key, value] of Object.entries(data)) {
    if (key === 'color') { updates.push('color = ?'); values.push(value); continue }
    const field = fieldMap.get(key)
    if (field) { updates.push(`${key} = ?`); values.push(convertDataType(value, field.type)) }
  }
  if (updates.length === 0) return
  const result = await db.run(
    `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id IN (${ids.map(() => '?').join(',')})`,
    [...values, ...ids]
  )
  return result
}

export const deleteModelData = async ({ modelId, ids }) => {
  const db = await initDatabase()
  await getModelFields(db, modelId)
  const tableName = `model_data_${modelId}`
  await db.run(
    `DELETE FROM ${tableName} WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  )
}

export const clearModelData = async ({ modelId }) => {
  const db = await initDatabase()
  await getModelFields(db, modelId)
  const tableName = `model_data_${modelId}`
  await db.run(`DELETE FROM ${tableName}`)
}

export const batchCreateModelData = async ({ modelId, data, batchSize = 1000 }) => {
  const db = await initDatabase()
  const fields = await getModelFields(db, modelId)
  const tableName = `model_data_${modelId}`
  const fieldMap = indexFieldsByName(fields)
  const fieldNames = fields.map((f) => f.name)
  const placeholders = `(${fieldNames.map(() => '?').join(',')})`
  const results = []
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)
    const valuesList = []
    const allPlaceholders = []
    batch.forEach((item) => {
      fieldNames.forEach((name) => {
        valuesList.push(convertDataType(item[name], fieldMap.get(name).type))
      })
      allPlaceholders.push(placeholders)
    })
    const sql = `INSERT OR IGNORE INTO ${tableName} (${fieldNames.join(',')}) VALUES ${allPlaceholders.join(',')}`
    try {
      const result = await db.run(sql, valuesList)
      results.push(result)
    } catch (error) {
      console.error('批量插入失败:', error)
      throw error
    }
  }
  return results
}

export const exportExcel = async ({ filePath, modelId, conditions, filters, sort, readFields }) => {
  let total = 1
  let exportDataNum = 0
  const params = { modelId, page: 1, pageSize: 5000, filters: filters || {}, conditions: conditions || [], sort: sort || null, readFields: readFields || [] }
  params.readFields.push('created_at')
  const options = { filename: filePath, useStyles: true, useSharedStrings: true }
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options)
  let worksheet = null
  let headers = []
  let rowCount = 0
  let sheetIndex = 1
  while (exportDataNum < total) {
    const res = await getModelData(params)
    total = res.total
    headers = [...res.fields, { name: 'created_at', description: '创建时间' }]
    if (rowCount >= 1000000 || worksheet === null) {
      worksheet = workbook.addWorksheet(`Sheet${sheetIndex++}`, { views: [{ state: 'frozen', ySplit: 1 }] })
      worksheet.columns = headers.map((h) => ({ header: h.description, key: h.name }))
      rowCount = 0
    }
    res.data.forEach((item) => { rowCount++; worksheet.addRow(item).commit() })
    global.mainView.webContents.send('data:importExcelProgress', { total, finished: exportDataNum })
    exportDataNum += res.data.length
    params.page++
  }
  worksheet.commit()
  await workbook.commit()
}

export const importExcel = async ({ filePath, modelId }) => {
  const model = await getModel(modelId).catch(() => null)
  if (!model) throw new Error('模型不存在')
  const fields = JSON.parse(model.fields)
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath)
  const rows = []
  let finished = 0
  reader.on('worksheet', (worksheet) => {
    let isColumnHeader = true
    const pageSize = 1000
    worksheet.on('row', async (row) => {
      if (isColumnHeader) { isColumnHeader = false; return }
      const item = {}
      fields.forEach((h, index) => { item[h.name] = row.getCell(index + 1).value })
      rows.push(item)
      if (rows.length >= pageSize) {
        const batchRows = [...rows]
        rows.length = 0
        await batchCreateModelData({ modelId, data: batchRows, batchSize: pageSize }).catch(() => null)
        finished += batchRows.length
        global.mainView.webContents.send('data:importExcelProgress', { total: '', finished })
      }
    })
  })
  return new Promise((resolve, reject) => {
    reader.on('end', async () => {
      if (rows.length > 0) {
        await batchCreateModelData({ modelId, data: rows }).catch(() => null)
        rows.length = 0
      }
      resolve()
    })
    reader.on('error', reject)
    reader.read()
  })
}
