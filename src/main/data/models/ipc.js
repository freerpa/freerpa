/**
 * @file: 数据管理IPC通信处理
 */
import { handleCrud } from '../ipcHelper.js'
import { getModel, copyModel, getModels, createModel, updateModel, deleteModel, getModelData, createModelData, updateModelData, deleteModelData, clearModelData, batchCreateModelData, exportExcel, importExcel, getTrashModels, restoreModel, permanentDeleteModel } from './index'

export const register = () => {
  handleCrud('data:getModel', getModel)
  handleCrud('data:copyModel', copyModel)
  handleCrud('data:getModels', getModels)
  handleCrud('data:createModel', createModel)
  handleCrud('data:updateModel', updateModel)
  handleCrud('data:deleteModel', deleteModel)
  handleCrud('data:getModelData', getModelData)
  handleCrud('data:createModelData', createModelData)
  handleCrud('data:updateModelData', updateModelData)
  handleCrud('data:deleteModelData', deleteModelData)
  handleCrud('data:clearModelData', clearModelData)
  handleCrud('data:batchCreateModelData', batchCreateModelData)
  handleCrud('data:exportExcel', exportExcel)
  handleCrud('data:importExcel', importExcel)
  handleCrud('data:getTrash', getTrashModels)
  handleCrud('data:restore', restoreModel)
  handleCrud('data:permanentDelete', permanentDeleteModel)
}
