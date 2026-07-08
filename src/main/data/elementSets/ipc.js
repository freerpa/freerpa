import { ipcMain } from 'electron'
import {
  getElementSets, getElementSet, createElementSet, updateElementSet,
  deleteElementSet, getTrashElementSets, restoreElementSet, permanentDeleteElementSet
} from './index.js'

export const register = () => {
  ipcMain.handle('elementSet:getElementSets', async (_e, params) => {
    try { return await getElementSets(params) } catch (e) { console.error('[elementSet:getElementSets]', e); throw e }
  })
  ipcMain.handle('elementSet:getElementSet', async (_e, id) => {
    try { return await getElementSet(id) } catch (e) { console.error('[elementSet:getElementSet]', e); throw e }
  })
  ipcMain.handle('elementSet:createElementSet', async (_e, params) => {
    try { return await createElementSet(params) } catch (e) { console.error('[elementSet:createElementSet]', e); throw e }
  })
  ipcMain.handle('elementSet:updateElementSet', async (_e, params) => {
    try { return await updateElementSet(params) } catch (e) { console.error('[elementSet:updateElementSet]', e); throw e }
  })
  ipcMain.handle('elementSet:deleteElementSet', async (_e, id) => {
    try { return await deleteElementSet(id) } catch (e) { console.error('[elementSet:deleteElementSet]', e); throw e }
  })
  ipcMain.handle('elementSet:getTrash', async () => {
    try { return await getTrashElementSets() } catch (e) { console.error('[elementSet:getTrash]', e); throw e }
  })
  ipcMain.handle('elementSet:restore', async (_e, id) => {
    try { return await restoreElementSet(id) } catch (e) { console.error('[elementSet:restore]', e); throw e }
  })
  ipcMain.handle('elementSet:permanentDelete', async (_e, id) => {
    try { return await permanentDeleteElementSet(id) } catch (e) { console.error('[elementSet:permanentDelete]', e); throw e }
  })
}
