/**
 * @file: 模型数据 CRUD（model_data_<id> 表：模型的数据行）
 * 负责：分页查询（含多条件组/排序/字段选择）、增删改、批量插入
 */
import { initDatabase } from '../db.js'
import { convertDataType, getModelFields, getWhereClause, indexFieldsByName } from './queryUtils.js'

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
