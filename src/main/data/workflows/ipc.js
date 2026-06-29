import { ipcMain } from 'electron'
import { getWorkflows, getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow, importWorkflow, exportWorkflow, getTrashWorkflows, restoreWorkflow, permanentDeleteWorkflow } from './index'

export const register = () => {
  ipcMain.handle('workflow:getWorkflows', async (_e, params) => {
    try { return await getWorkflows(params) } catch (e) { console.error('[workflow:getWorkflows]', e); throw e }
  })
  ipcMain.handle('workflow:getWorkflow', async (_e, id) => {
    try { return await getWorkflow(id) } catch (e) { console.error('[workflow:getWorkflow]', e); throw e }
  })
  ipcMain.handle('workflow:createWorkflow', async (_e, params) => {
    try { return await createWorkflow(params) } catch (e) { console.error('[workflow:createWorkflow]', e); throw e }
  })
  ipcMain.handle('workflow:updateWorkflow', async (_e, params) => {
    try { return await updateWorkflow(params) } catch (e) { console.error('[workflow:updateWorkflow]', e); throw e }
  })
  ipcMain.handle('workflow:deleteWorkflow', async (_e, id) => {
    try { return await deleteWorkflow(id) } catch (e) { console.error('[workflow:deleteWorkflow]', e); throw e }
  })
  ipcMain.handle('workflow:importWorkflow', async (_e, params) => {
    try { return await importWorkflow(params) } catch (e) { console.error('[workflow:importWorkflow]', e); throw e }
  })
  ipcMain.handle('workflow:exportWorkflow', async (_e, id) => {
    try { return await exportWorkflow(id) } catch (e) { console.error('[workflow:exportWorkflow]', e); throw e }
  })
  // 回收站
  ipcMain.handle('workflow:getTrash', async () => {
    try { return await getTrashWorkflows() } catch (e) { console.error('[workflow:getTrash]', e); throw e }
  })
  ipcMain.handle('workflow:restore', async (_e, id) => {
    try { return await restoreWorkflow(id) } catch (e) { console.error('[workflow:restore]', e); throw e }
  })
  ipcMain.handle('workflow:permanentDelete', async (_e, id) => {
    try { return await permanentDeleteWorkflow(id) } catch (e) { console.error('[workflow:permanentDelete]', e); throw e }
  })
}
