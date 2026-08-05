/**
 * @file: 数据管理模块 — 统一入口
 * 聚合 models / workflows / browsers / categories / elementSets 子模块
 */

// Re-export models（仅引擎 RPC 需要的数据模型读写）
export {
  getModelData, updateModelData, deleteModelData, batchCreateModelData
} from './models/index.js'

// 统一 IPC 注册
import { register as registerModels } from './models/ipc.js'
import { register as registerWorkflows } from './workflows/ipc.js'
import { register as registerBrowsers } from './browsers/ipc.js'
import { register as registerCategories } from './categories/ipc.js'
import { register as registerElementSets } from './elementSets/ipc.js'

export const register = () => {
  registerModels()
  registerWorkflows()
  registerBrowsers()
  registerCategories()
  registerElementSets()
}
