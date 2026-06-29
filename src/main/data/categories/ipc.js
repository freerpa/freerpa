import { ipcMain } from 'electron'
import { getCategories, addCategory, updateCategory, deleteCategory } from './index'

export const register = () => {
  ipcMain.handle('category:getCategories', async (_e, type) => {
    try { return await getCategories(type) } catch (e) { console.error('[category:getCategories]', e); throw e }
  })
  ipcMain.handle('category:addCategory', async (_e, type, name) => {
    try { return await addCategory(type, name) } catch (e) { console.error('[category:addCategory]', e); throw e }
  })
  ipcMain.handle('category:updateCategory', async (_e, id, name) => {
    try { return await updateCategory(id, name) } catch (e) { console.error('[category:updateCategory]', e); throw e }
  })
  ipcMain.handle('category:deleteCategory', async (_e, id) => {
    try { return await deleteCategory(id) } catch (e) { console.error('[category:deleteCategory]', e); throw e }
  })
}
