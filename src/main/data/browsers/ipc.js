import { ipcMain } from 'electron'
import { getBrowsers, getBrowser, createBrowser, updateBrowser, deleteBrowser, importBrowser, exportBrowser, getTrashBrowsers, restoreBrowser, permanentDeleteBrowser } from './index'

export const register = () => {
  ipcMain.handle('browser:getBrowsers', async (_e, params) => {
    try { return await getBrowsers(params) } catch (e) { console.error('[browser:getBrowsers]', e); throw e }
  })
  ipcMain.handle('browser:getBrowser', async (_e, id) => {
    try { return await getBrowser(id) } catch (e) { console.error('[browser:getBrowser]', e); throw e }
  })
  ipcMain.handle('browser:createBrowser', async (_e, params) => {
    try { return await createBrowser(params) } catch (e) { console.error('[browser:createBrowser]', e); throw e }
  })
  ipcMain.handle('browser:updateBrowser', async (_e, params) => {
    try { return await updateBrowser(params) } catch (e) { console.error('[browser:updateBrowser]', e); throw e }
  })
  ipcMain.handle('browser:deleteBrowser', async (_e, id) => {
    try { return await deleteBrowser(id) } catch (e) { console.error('[browser:deleteBrowser]', e); throw e }
  })
  ipcMain.handle('browser:importBrowser', async (_e, params) => {
    try { return await importBrowser(params) } catch (e) { console.error('[browser:importBrowser]', e); throw e }
  })
  ipcMain.handle('browser:exportBrowser', async (_e, id) => {
    try { return await exportBrowser(id) } catch (e) { console.error('[browser:exportBrowser]', e); throw e }
  })
  ipcMain.handle('browser:getTrash', async () => {
    try { return await getTrashBrowsers() } catch (e) { console.error('[browser:getTrash]', e); throw e }
  })
  ipcMain.handle('browser:restore', async (_e, id) => {
    try { return await restoreBrowser(id) } catch (e) { console.error('[browser:restore]', e); throw e }
  })
  ipcMain.handle('browser:permanentDelete', async (_e, id) => {
    try { return await permanentDeleteBrowser(id) } catch (e) { console.error('[browser:permanentDelete]', e); throw e }
  })
}
