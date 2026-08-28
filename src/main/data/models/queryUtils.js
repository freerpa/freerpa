/**
 * @file: 模型数据层共用工具（modelCrud / modelDataCrud / excelIO 共享）
 * - getColumnType / generateCreateTableSQL：字段类型 → SQL 列定义与建表
 * - convertDataType：写入前按字段类型转换
 * - getWhereClause：单条查询条件 → WHERE 片段 + 参数
 * - getModelFields / invalidateModelFields / indexFieldsByName：模型字段解析缓存与索引
 */

/** 字段类型 → SQLite 列类型 */
export const getColumnType = (field) => {
  switch (field.type) {
    case 'number': return 'REAL'
    default: return 'TEXT'
  }
}

/** 生成 model_data_<id> 建表 SQL */
export const generateCreateTableSQL = (id, fields) => {
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

/** 写入前按字段类型转换（number 非法输入归 0；date 非法输入用今天） */
export const convertDataType = (value, fieldType) => {
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

/** 单条查询条件 → WHERE 片段 + 参数（供 getModelData 的 filters/conditions 复用） */
export const getWhereClause = (condition) => {
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

// ═══════════ 模型字段解析缓存 ═══════════
// 消除各 CRUD 里重复的 db.get('SELECT * FROM models') + JSON.parse(model.fields) 样板。
// 缓存以 db 实例为键（db 为应用共享单例，Map 不会随连接重建而泄漏），
// 模型结构变更（update/permanentDelete）时由 modelCrud 按 modelId 失效。
const fieldsCache = new Map()

/** 读取并解析模型字段（带缓存）；模型不存在抛错 */
export const getModelFields = async (db, modelId) => {
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

/** 模型结构变更后失效对应缓存（modelCrud 的 updateModel/permanentDeleteModel 调用） */
export const invalidateModelFields = (modelId) => {
  for (const cache of fieldsCache.values()) cache.delete(modelId)
}

/** 字段数组 → { name: field } 索引（消除 batchCreate/update 内层线性 find） */
export const indexFieldsByName = (fields) => new Map(fields.map((f) => [f.name, f]))
