/**
 * @file: 数据管理模块
 * @author: dabao
 * @date: 2024-03-15
 */

import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { app, BaseWindow } from 'electron'
import fs from 'fs'

let db = null
// 初始化数据库
const initDatabase = async () => {
  const win = BaseWindow.getAllWindows().find((win) => win.id === 1)
  const userId = await win.contentView.children[0].webContents.executeJavaScript(
    "localStorage.getItem('userId')"
  )
  if (db && db.db.open) {
    if (db.config.filename.includes(userId)) {
      return db
    } else {
      db.close()
      db = null
    }
  }
  const userDataPath = app.getPath('appData')
  //创建数据库目录
  const dbDir = path.join(userDataPath, 'storage/' + userId)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  const dbPath = path.join(dbDir, 'database.sqlite')

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  })

  // 创建模型表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      fields TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
    )
  `)

  return db
}

// 获取模型
export const getModel = async (id) => {
  const db = await initDatabase()
  return db.get('SELECT * FROM models WHERE id = ?', id)
}

// 获取所有模型
export const getModels = async ({ page = 1, pageSize = 8, keyword = '' }) => {
  const db = await initDatabase()

  // 构建查询条件
  const whereClause = keyword ? 'WHERE name LIKE ? OR description LIKE ?' : ''
  const params = keyword ? [`%${keyword}%`, `%${keyword}%`] : []

  // 获取总数
  const countResult = await db.get(`SELECT COUNT(*) as total FROM models ${whereClause}`, params)

  // 获取分页数据
  const offset = (page - 1) * pageSize
  const getTableName = (id) => `model_data_${id}`

  const data = await db.all(
    `SELECT
       m.*,
       0 as data_count
     FROM models m
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  // 处理字段信息统计和数据计数
  for (const model of data) {
    try {
      const countResult = await db.get(`SELECT COUNT(*) as count FROM ${getTableName(model.id)}`)
      model.data_count = countResult.count
    } catch (error) {
      model.data_count = 0
    }

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

  return {
    total: countResult.total,
    data,
    page,
    pageSize
  }
}

// 创建模型
export const createModel = async ({ name, description, fields }) => {
  const db = await initDatabase()
  const id = uuidv4().replace(/-/g, '_')

  // 添加排序字段
  fields = fields.map((field, index) => ({
    ...field,
    sort: index
  }))

  await db.run('BEGIN TRANSACTION')
  try {
    // 插入模型记录
    await db.run(`INSERT INTO models (id, name, description, fields) VALUES (?, ?, ?, ?)`, [
      id,
      name,
      description,
      JSON.stringify(fields)
    ])

    // 创建新表
    await db.exec(generateCreateTableSQL(id, fields))

    // 创建唯一索引
    for (const field of fields) {
      if (field.unique) {
        await db.exec(
          `CREATE UNIQUE INDEX idx_${id}_${field.name} ON model_data_${id} (${field.name})`
        )
      }
    }

    await db.run('COMMIT')
    return id
  } catch (error) {
    await db.run('ROLLBACK')
    throw error
  }
}

// 更新模型
export const updateModel = async ({ id, name, description, fields }) => {
  const db = await initDatabase()
  console.log('updateModel', id, name, description, fields)

  // 获取原有字段的排序
  const model = await db.get('SELECT fields FROM models WHERE id = ?', id)
  if (!model) {
    throw new Error('模型不存在')
  }

  // 检查是否有数据
  const tableName = `model_data_${id}`
  const hasData = await db.get(`SELECT COUNT(*) as count FROM ${tableName}`)
  const hasExistingData = hasData.count > 0

  // 如果有数据且字段发生变化，则不允许更新
  if (hasExistingData) {
    const oldFields = JSON.parse(model.fields)
    const oldFieldNames = oldFields
      .map((f) => f.name)
      .sort()
      .join(',')
    const newFieldNames = fields
      .map((f) => f.name)
      .sort()
      .join(',')

    if (oldFieldNames !== newFieldNames) {
      throw new Error('模型已有数据，不能修改字段结构')
    }

    // 检查字段类型是否变化
    const oldFieldMap = Object.fromEntries(oldFields.map((f) => [f.name, f.type]))
    const hasTypeChange = fields.some((f) => oldFieldMap[f.name] !== f.type)

    if (hasTypeChange) {
      throw new Error('模型已有数据，不能修改字段类型')
    }
  }

  // 开启事务
  await db.run('BEGIN TRANSACTION')

  try {
    // 更新模型基本信息
    await db.run(
      `UPDATE models SET name = ?, description = ?, fields = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, description, JSON.stringify(fields), id]
    )

    // 如果没有数据，则重建表结构
    if (!hasExistingData) {
      // 删除旧表
      await db.run(`DROP TABLE IF EXISTS ${tableName}`)
      // 创建新表
      await db.exec(generateCreateTableSQL(id, fields))
      // 创建唯一索引
      for (const field of fields) {
        if (field.unique) {
          await db.exec(
            `CREATE UNIQUE INDEX idx_${id}_${field.name} ON ${tableName} (${field.name})`
          )
        }
      }
    }

    await db.run('COMMIT')
  } catch (error) {
    await db.run('ROLLBACK')
    throw error
  }
}

// 删除模型
export const deleteModel = async (id) => {
  const db = await initDatabase()

  // 获取模型信息
  const model = await db.get('SELECT * FROM models WHERE id = ?', id)
  if (!model) {
    throw new Error('模型不存在')
  }

  // 开启事务
  await db.run('BEGIN TRANSACTION')

  try {
    // 删除模型记录
    await db.run('DELETE FROM models WHERE id = ?', id)

    // 删除数据表
    await db.run(`DROP TABLE IF EXISTS model_data_${id}`)

    await db.run('COMMIT')
  } catch (error) {
    await db.run('ROLLBACK')
    throw error
  }
}

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


const getWhereClause = (condition) => {
  const { field, operator, value } = condition
  if (!field || !operator || value === undefined) {
    return { whereClause: '', params: [] }
  }
  let whereClause = ''
  let params = []
  // 根据操作符构建查询条件
  switch (operator) {
    case 'eq':
      whereClause += ` ${field} = ?`
      params.push(value)
      break
    case 'ne':
      whereClause += ` ${field} != ?`
      params.push(value)
      break
    case 'gt':
      whereClause += ` ${field} > ?`
      params.push(value)
      break
    case 'gte':
      whereClause += ` ${field} >= ?`
      params.push(value)
      break
    case 'lt':
      whereClause += ` ${field} < ?`
      params.push(value)
      break
    case 'lte':
      whereClause += ` ${field} <= ?`
      params.push(value)
      break
    case 'like':
      whereClause += ` ${field} LIKE ?`
      params.push(`%${value}%`)
      break
    case 'notLike':
      whereClause += ` ${field} NOT LIKE ?`
      params.push(`%${value}%`)
      break
    case 'in':
      if (typeof value === 'string' && value.includes(',')) {
        // 处理范围值
        const [min, max] = value.split(',')
        whereClause += ` ${field} BETWEEN ? AND ?`
        params.push(min, max)
      } else if (Array.isArray(value)) {
        // 处理多个值
        whereClause += ` ${field} IN (${value.map(() => '?').join(',')})`
        params.push(...value)
      } else {
        whereClause += ` ${field} IN (?)`
        params.push(value)
      }
      break
    case 'notIn':
      if (typeof value === 'string' && value.includes(',')) {
        // 处理范围值
        const [min, max] = value.split(',')
        whereClause += ` ${field} NOT BETWEEN ? AND ?`
        params.push(min, max)
      } else if (Array.isArray(value)) {
        // 处理多个值
        whereClause += ` ${field} NOT IN (${value.map(() => '?').join(',')})`
        params.push(...value)
      } else {
        whereClause += ` ${field} NOT IN (?)`
        params.push(value)
      }
      break
    case 'isNull':
      whereClause += ` (${field} IS NULL OR ${field} = '')`
      break
    case 'isNotNull':
      whereClause += ` ${field} IS NOT NULL AND ${field} != ''`
      break
  }
  return { whereClause, params }
}

// 获取模型数据
export const getModelData = async ({
  modelId,
  page = 1,
  pageSize = 10,
  filters = {},
  conditions = [],
  sort = null,
  readFields = []
}) => {
  const db = await initDatabase()
  const tableName = `model_data_${modelId}`

  try {
    // 构建 WHERE 子句
    let whereClause = 'WHERE 1=1'
    const params = []

    // 处理筛选条件
    Object.entries(filters).forEach(([field, condition]) => {
      if (condition && condition.operator) {
        const { operator, value } = condition
        const { whereClause: conditionWhereClause, params: conditionParams } = getWhereClause({ field, operator, value })
        if (conditionWhereClause) {
          whereClause += ' AND ' + conditionWhereClause
          params.push(...conditionParams)
        }
      }
    })

    conditions.forEach((group) => {
      const groupWhereClause = []
      const { logic, conditions: groupConditions } = group
      groupConditions.forEach((condition) => {
        const { whereClause: conditionWhereClause, params: conditionParams } = getWhereClause(condition)
        if (conditionWhereClause) {
          groupWhereClause.push(conditionWhereClause)
          params.push(...conditionParams)
        }
      })
      if (groupWhereClause.length > 0) {
        if (logic === 'and') {
          whereClause += ' AND (' + groupWhereClause.join(' AND ') + ')'
        } else {
          whereClause += ' AND (' + groupWhereClause.join(' OR ') + ')'
        }
      }
    })
    console.log('whereClause', whereClause);
    // 构建排序子句
    let orderClause = ''
    if (sort && sort.length > 0) {
      orderClause = ` ORDER BY`
      sort.forEach((item) => {
        if (item.field) {
          orderClause += ` ${item.field}`
        }
        if (item.order) {
          orderClause += ` ${item.order.toUpperCase()}`
        }
      })
    }

    // 获取总数
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`,
      params
    )

    // 获取分页数据
    const offset = (page - 1) * pageSize
    const data = await db.all(
      `SELECT ${readFields.join(', ') || '*'} FROM ${tableName} ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )
    // 获取字段信息
    const model = await db.get('SELECT * FROM models WHERE id = ?', [modelId])
    const fields = JSON.parse(model.fields)

    // 按排序字段排序
    fields.sort((a, b) => a.sort - b.sort)

    return {
      total: countResult.total,
      data,
      fields,
      page,
      pageSize
    }
  } catch (error) {
    throw new Error('获取数据失败:' + error.message)
  }
}

// 处理数据类型转换
const convertDataType = (value, fieldType) => {
  switch (fieldType) {
    case 'number':
      try {
        return Number(value)
      } catch (err) {
        return 0
      }
    case 'date':
      try {
        return new Date(value).toLocaleString('sv-SE').substring(0, 10)
      } catch (err) {
        return new Date().toLocaleString('sv-SE').substring(0, 10)
      }
    default:
      return value
  }
}

// 创建模型数据
export const createModelData = async ({ modelId, data }) => {
  const db = await initDatabase()
  // 获取模型信息
  const model = await db.get('SELECT * FROM models WHERE id = ?', modelId)
  if (!model) {
    throw new Error('模型不存在')
  }

  const fields = JSON.parse(model.fields)
  const tableName = `model_data_${modelId}`

  // 构建插入语句
  const fieldNames = fields.map((f) => f.name)
  const placeholders = fieldNames.map(() => '?')
  const values = fieldNames.map((name) => {
    const field = fields.find((f) => f.name === name)
    const value = data[name]

    // 类型转换
    return convertDataType(value, field.type)
  })
  console.log('values', values);
  const result = await db.run(
    `INSERT INTO ${tableName} (${fieldNames.join(', ')})
     VALUES (${placeholders.join(', ')})`,
    values
  )

  return result.lastID
}

// 更新模型数据
export const updateModelData = async ({ modelId, ids, data }) => {
  const db = await initDatabase()

  // 获取模型信息
  const model = await db.get('SELECT * FROM models WHERE id = ?', modelId)
  if (!model) {
    throw new Error('模型不存在')
  }

  const fields = JSON.parse(model.fields)
  const tableName = `model_data_${modelId}`

  // 构建更新语句
  const updates = []
  const values = []
  // 处理字段更新
  for (const [key, value] of Object.entries(data)) {
    // 特殊处理 color 字段
    if (key === 'color') {
      updates.push('color = ?')
      values.push(value)
      continue
    }

    const field = fields.find((f) => f.name === key)
    if (field) {
      updates.push(`${key} = ?`)
      // 类型转换
      values.push(convertDataType(value, field.type))
    }
  }

  if (updates.length === 0) return

  const result = await db.run(
    `UPDATE ${tableName}
     SET ${updates.join(', ')}
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    [...values, ...ids]
  )

  return result
}

// 删除模型数据
export const deleteModelData = async ({ modelId, ids }) => {
  const db = await initDatabase()

  // 获取模型信息
  const model = await db.get('SELECT * FROM models WHERE id = ?', modelId)
  if (!model) {
    throw new Error('模型不存在')
  }

  const tableName = `model_data_${modelId}`
  await db.run(`DELETE FROM ${tableName} WHERE id in (${ids.join(',')})`)
}

// 清空模型数据
export const clearModelData = async ({ modelId }) => {
  const db = await initDatabase()

  // 获取模型信息
  const model = await db.get('SELECT * FROM models WHERE id = ?', modelId)
  if (!model) {
    throw new Error('模型不存在')
  }

  const tableName = `model_data_${modelId}`
  await db.run(`DELETE FROM ${tableName}`)
}

/**
 * 批量创建数据
 * @param {Object} params 参数对象
 * @param {string} params.modelId 数据表ID
 * @param {Array} params.data 要保存的数据数组
 * @param {number} params.batchSize 每批次处理的数据量
 */
export const batchCreateModelData = async ({ modelId, data, batchSize = 1000 }) => {
  const db = await initDatabase()

  // 获取模型信息
  const model = await db.get('SELECT * FROM models WHERE id = ?', modelId)
  if (!model) {
    throw new Error('模型不存在')
  }

  const fields = JSON.parse(model.fields)
  const tableName = `model_data_${modelId}`

  // 获取字段名列表
  const fieldNames = fields.map((f) => f.name)

  // 构建单条插入的SQL语句
  const placeholders = `(${fieldNames.map(() => '?').join(',')})`

  // 分批处理数据
  const results = []
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)

    // 构建批量插入的SQL和值数组
    const valuesList = []
    const allPlaceholders = []

    batch.forEach((item) => {
      // 按字段顺序处理每条数据的值
      fieldNames.forEach((name) => {
        const field = fields.find((f) => f.name === name)
        const value = item[name]
        // 类型转换
        valuesList.push(convertDataType(value, field.type))
      })
      allPlaceholders.push(placeholders)
    })

    // 构建最终的SQL语句
    const sql = `INSERT OR IGNORE INTO ${tableName} (${fieldNames.join(
      ','
    )}) VALUES ${allPlaceholders.join(',')}`

    // 执行批量插入
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

// 创建数据表时的类型映射
const getColumnType = (field) => {
  switch (field.type) {
    case 'number':
      return 'REAL'
    default:
      return 'TEXT'
  }
}

// 创建数据表时的默认值
const getDefaultValue = (field) => {
  switch (field.type) {
    case 'number':
      return 'NULL'
    default:
      return 'NULL'
  }
}

// 复制模型
export const copyModel = async (id) => {
  const db = await initDatabase()

  // 获取原模型信息
  const model = await db.get('SELECT * FROM models WHERE id = ?', id)
  if (!model) {
    throw new Error('模型不存在')
  }

  // 生成新ID和名称
  const newId = uuidv4().replace(/-/g, '_')
  const newName = `${model.name} - 副本`

  // 开启事务
  await db.run('BEGIN TRANSACTION')

  try {
    // 解析字段信息
    const fields = JSON.parse(model.fields)

    // 插入新模型记录
    await db.run(
      `INSERT INTO models (id, name, description, fields)
       VALUES (?, ?, ?, ?)`,
      [newId, newName, model.description, JSON.stringify(fields)]
    )

    // 创建新数据表
    const columns = fields
      .map(
        (field) =>
          `${field.name} ${getColumnType(field)} ${field.required ? 'NOT NULL' : ''
          } DEFAULT ${getDefaultValue(field)}`
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

    // 创建唯一索引
    for (const field of fields) {
      if (field.unique) {
        await db.exec(
          `CREATE UNIQUE INDEX idx_${newId}_${field.name} ON model_data_${newId} (${field.name})`
        )
      }
    }

    await db.run('COMMIT')
    return newId
  } catch (error) {
    console.error('复制模型失败:', error)
    await db.run('ROLLBACK')
    throw error
  }
}


import ExcelJS from 'exceljs'
export const exportExcel = async ({ filePath, modelId, conditions, filters, sort, readFields }) => {
  let total = 1
  let exportDataNum = 0
  const params = {
    modelId,
    page: 1,
    pageSize: 100000,
    filters: filters || {},
    conditions: conditions || [],
    sort: sort || null,
    readFields: readFields || []
  }
  params.readFields.push('created_at')
  // 使用样式和共享字符串构造流式 XLSX 工作簿编写器
  const options = {
    filename: filePath,
    useStyles: true,
    useSharedStrings: true
  };
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
  let worksheet = null;
  let headers = []
  let rowCount = 0
  let sheetIndex = 1
  while (exportDataNum < total) {
    const res = await getModelData(params)
    total = res.total
    headers = [...res.fields, { name: 'created_at', description: '创建时间' }]
    if (rowCount >= 1000000 || worksheet === null) {
      worksheet = workbook.addWorksheet(`Sheet${sheetIndex++}`, { views: [{ state: 'frozen', ySplit: 1 }] });
      worksheet.columns = headers.map((h) => ({ header: h.description, key: h.name }))
      rowCount = 0
    }
    // console.log('res.data', res.data);
    res.data.forEach((item) => {
      rowCount++
      worksheet.addRow(item).commit();
    })
    global.mainView.webContents.send('data:importExcelProgress', {
      total,
      finished: exportDataNum
    })
    exportDataNum += res.data.length
    params.page++
  }
  worksheet.commit();
  await workbook.commit();
}


export const importExcel = ({ filePath, modelId }) => {
  return new Promise(async (resolve, reject) => {
    const model = await getModel(modelId).catch(() => null)
    if (!model) {
      reject(new Error('模型不存在'))
    }
    const fields = JSON.parse(model.fields)
    // 创建一个 WorkbookReader 实例
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
    const rows = []
    let finished = 0
    reader.on('worksheet', async (worksheet) => {
      let isColumnHeader = true
      const pageSize = 1000
      worksheet.on('row', async (row) => {
        if (isColumnHeader) {
          isColumnHeader = false
          return
        }
        const item = {}
        fields.forEach((h, index) => {
          item[h.name] = row.getCell(index + 1).value
        })
        rows.push(item)
        if (rows.length >= pageSize) {
          const batchRows = [...rows]
          rows.length = 0
          await batchCreateModelData({
            modelId,
            data: batchRows,
            batchSize: pageSize
          }).catch(() => null)
          // 发送进度更新
          finished += batchRows.length
          global.mainView.webContents.send('data:importExcelProgress', {
            total: '',
            finished
          })
        }
      });
    });
    reader.on('end', async () => {
      if (rows.length > 0) {
        await batchCreateModelData({
          modelId,
          data: rows
        }).catch(() => null)
        rows.length = 0
      }
      resolve()
    })
    reader.on('error', (err) => {
      reject(err)
    })
    reader.read();
  })
}
