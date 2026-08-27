/**
 * @file: 外部数据库连接管理（主进程）
 * 统一经 knex 支持多种 SQL 数据库（MySQL/MariaDB、PostgreSQL、SQLite）。
 * 连接按 flowId 归属，工作流终态（completed/stopped/error）时由 host 自动关闭，避免泄漏。
 *
 * 安全说明：连接配置仅经 worker RPC 传入（worker 是 deno 最小权限，无直接网络能力），
 * 实际 TCP/网络连接与 SQL 执行均发生在主进程 Node 环境。
 */
import knex from 'knex'
import path from 'node:path'
import fs from 'node:fs'

/** flowId → Map<connectionId, knex 实例> */
const flowConnections = new Map()

/** 数据库类型 → knex client 名（knex 支持 mysql2/pg/sqlite3） */
const CLIENT_MAP = {
  mysql: 'mysql2',
  postgres: 'pg',
  sqlite: 'sqlite3'
}

/** 生成连接 id（flowId 前缀便于归属追踪） */
const genId = (flowId) => `db-${flowId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * 建立数据库连接
 * @param {string} flowId 工作流 id（归属校验）
 * @param {Object} config { dbType, host, port, database, username, password, filePath }
 * @returns {Promise<{connectionId: string, dbType: string}>}
 */
export const dbConnect = async (flowId, config = {}) => {
  const { dbType = 'mysql', host, port, database, username, password, filePath } = config
  const client = CLIENT_MAP[dbType]
  if (!client) throw new Error(`不支持的数据库类型: ${dbType}`)

  let connectionConfig
  if (dbType === 'sqlite') {
    if (!filePath) throw new Error('SQLite 连接必须指定数据库文件路径')
    // 规范化绝对路径 + 确保父目录存在（knex/sqlite3 不会自动创建目录，否则报 SQLITE_CANTOPEN）
    const absPath = path.resolve(String(filePath))
    const dir = path.dirname(absPath)
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (e) {
      throw new Error(`SQLite 目录创建失败（${dir}）: ${e.message}`)
    }
    connectionConfig = { filename: absPath }
  } else {
    if (!host) throw new Error(`请填写 ${dbType} 数据库主机地址`)
    connectionConfig = { host, port: port || undefined, database, user: username, password }
  }

  const instance = knex({
    client,
    connection: connectionConfig,
    pool: { min: 0, max: 5 },
    useNullAsDefault: dbType === 'sqlite'
  })

  // 连接校验（真实建连，失败立即抛出可读错误）
  try {
    await instance.raw('SELECT 1')
  } catch (error) {
    await instance.destroy()
    throw new Error(`数据库连接失败: ${error.message}`)
  }

  const connectionId = genId(flowId)
  if (!flowConnections.has(flowId)) flowConnections.set(flowId, new Map())
  flowConnections.get(flowId).set(connectionId, instance)
  return { connectionId, dbType }
}

/**
 * 执行 SQL
 * @param {string} connectionId 连接引用
 * @param {string} sql SQL 语句
 * @returns {Promise<Object>} { rows, affectedRows, fields }（SELECT 返回行数组，写操作返回影响行数）
 */
export const dbQuery = async (connectionId, sql) => {
  const { instance } = findConnection(connectionId)
  if (!sql || typeof sql !== 'string') throw new Error('SQL 语句不能为空')
  try {
    const raw = await instance.raw(sql)
    return normalizeResult(raw)
  } catch (error) {
    throw new Error(`SQL 执行失败: ${error.message}`)
  }
}

/** 归一化不同驱动返回结构（mysql2: [rows, fields]；pg: {rows}；sqlite3: {rows}） */
const normalizeResult = (raw) => {
  if (Array.isArray(raw)) {
    const rows = Array.isArray(raw[0]) ? raw[0] : raw
    return { rows, affectedRows: raw.affectedRows ?? raw.changedRows ?? 0 }
  }
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.rows)) {
      return { rows: raw.rows, affectedRows: raw.changes ?? raw.rowCount ?? 0 }
    }
    // 写操作返回（mysql2 raw 可能是非数组对象）
    return { rows: raw, affectedRows: raw.affectedRows ?? raw.changes ?? raw.rowCount ?? 0 }
  }
  return { rows: raw, affectedRows: 0 }
}

/** 按 connectionId 查找（跨 flow 遍历：id 可能含多种字符，不用分隔符解析） */
const findConnection = (connectionId) => {
  if (!connectionId || typeof connectionId !== 'string') throw new Error('无效的数据库连接引用')
  for (const [flowId, map] of flowConnections) {
    const instance = map.get(connectionId)
    if (instance) return { flowId, instance }
  }
  throw new Error('数据库连接不存在或已关闭')
}

/** 关闭单个连接 */
export const dbClose = async (connectionId) => {
  const { flowId, instance } = findConnection(connectionId)
  flowConnections.get(flowId)?.delete(connectionId)
  try {
    await instance.destroy()
  } catch { /* 已关闭 */ }
}

/** 关闭某工作流的全部连接（工作流终态调用） */
export const dbCloseAll = async (flowId) => {
  const map = flowConnections.get(flowId)
  if (!map) return
  flowConnections.delete(flowId)
  for (const instance of map.values()) {
    try {
      await instance.destroy()
    } catch { /* 已关闭 */ }
  }
}
