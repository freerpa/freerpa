/**
 * @file: @dataModule 桥 — 数据模型 CRUD 经主进程 RPC（SQLite 在主进程）
 */
import { bridge } from './bridge.js'

const rpc = (method) => (...args) => bridge.rpc(method, ...args)

export const getModelData = rpc('data.getModelData')
export const updateModelData = rpc('data.updateModelData')
export const deleteModelData = rpc('data.deleteModelData')
export const batchCreateModelData = rpc('data.batchCreateModelData')
