/**
 * @file: 数据管理IPC通信处理
 * @author: dabao
 * @date: 2024-03-15
 */
import { ipcMain } from 'electron'
import { getModel, copyModel, getModels, createModel, updateModel, deleteModel, getModelData, createModelData, updateModelData, deleteModelData, clearModelData, batchCreateModelData, exportExcel ,importExcel, getTrashModels, restoreModel, permanentDeleteModel} from './index'

export const register = () => {
  // 获取模型
  ipcMain.handle('data:getModel', async (event, params) => {
    return await getModel(params)
  })

  // 复制模型
  ipcMain.handle('data:copyModel', async (event, params) => {
    return await copyModel(params)
  })

  // 获取模型列表
  ipcMain.handle('data:getModels', async (event, params) => {
    return await getModels(params)
  })

  // 创建模型
  ipcMain.handle('data:createModel', async (event, params) => {
    return await createModel(params)
  })

  // 更新模型
  ipcMain.handle('data:updateModel', async (event, params) => {
    return await updateModel(params)
  })

  // 删除模型
  ipcMain.handle('data:deleteModel', async (event, params) => {
    return await deleteModel(params)
  })

  // 获取模型数据
  ipcMain.handle('data:getModelData', async (event, params) => {
    return await getModelData(params)
  })

  // 创建模型数据
  ipcMain.handle('data:createModelData', async (event, params) => {
    return await createModelData(params)
  })

  // 更新模型数据
  ipcMain.handle('data:updateModelData', async (event, params) => {
    return await updateModelData(params)
  })

  // 删除模型数据
  ipcMain.handle('data:deleteModelData', async (event, params) => {
    return await deleteModelData(params)
  })

  // 清空模型数据
  ipcMain.handle('data:clearModelData', async (event, params) => {
    return await clearModelData(params)
  })

  // 添加批量创建数据的处理器
  ipcMain.handle('data:batchCreateModelData', async (event, params) => {
    return await batchCreateModelData(params)
  })

  // 导出模型数据到Excel
  ipcMain.handle('data:exportExcel', async (event, params) => {
    return await exportExcel(params)
  })

  // 导入Excel数据到模型
  ipcMain.handle('data:importExcel', async (event, params) => {
    return await importExcel(params)
  })
  // 回收站
  ipcMain.handle('data:getTrash', async () => getTrashModels())
  ipcMain.handle('data:restore', async (_e, id) => restoreModel(id))
  ipcMain.handle('data:permanentDelete', async (_e, id) => permanentDeleteModel(id))
}
