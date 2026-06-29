/**
 * @file: 数据管理模块 — 统一入口
 * 聚合 models / workflows / browsers / categories 四个子模块
 */

export { initDatabase } from './db.js'

// Re-export models
export {
  getModel, getModels, createModel, updateModel, deleteModel, copyModel,
  getModelData, createModelData, updateModelData, deleteModelData,
  clearModelData, batchCreateModelData, exportExcel, importExcel
} from './models/index.js'

// Re-export workflows
export {
  getWorkflows, getWorkflow, createWorkflow, updateWorkflow,
  deleteWorkflow, importWorkflow, exportWorkflow
} from './workflows/index.js'

// Re-export browsers
export {
  getBrowsers, getBrowser, createBrowser, updateBrowser,
  deleteBrowser, importBrowser, exportBrowser
} from './browsers/index.js'

// Re-export categories
export {
  getCategories, addCategory, updateCategory, deleteCategory
} from './categories/index.js'

// 统一 IPC 注册
import { register as registerModels } from './models/ipc.js'
import { register as registerWorkflows } from './workflows/ipc.js'
import { register as registerBrowsers } from './browsers/ipc.js'
import { register as registerCategories } from './categories/ipc.js'

export const register = () => {
  registerModels()
  registerWorkflows()
  registerBrowsers()
  registerCategories()
}
