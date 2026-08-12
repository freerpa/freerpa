/**
 * @file: @dataModule 桥 — 数据模型 CRUD 经主进程 RPC（SQLite 在主进程）
 */
import { bridge } from './bridge.js'

const rpc = (method) => (...args) => bridge.rpc(method, ...args)

export const getModelData = rpc('data.getModelData')
export const updateModelData = rpc('data.updateModelData')
export const deleteModelData = rpc('data.deleteModelData')
export const batchCreateModelData = rpc('data.batchCreateModelData')

// 外部数据库（连接/执行均在主进程，worker 仅透传配置与 SQL；flowId 由宿主注入）
export const dbConnect = (config) => bridge.rpc('db.connect', config)
export const dbQuery = (connectionId, sql) => bridge.rpc('db.query', connectionId, sql)
export const dbClose = (connectionId) => bridge.rpc('db.close', connectionId)
