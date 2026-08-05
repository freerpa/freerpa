import { handleCrud } from '../ipcHelper.js'
import { getBrowsers, getBrowser, createBrowser, updateBrowser, deleteBrowser, getTrashBrowsers, restoreBrowser, permanentDeleteBrowser } from './index'

export const register = () => {
  handleCrud('browser:getBrowsers', getBrowsers)
  handleCrud('browser:getBrowser', getBrowser)
  handleCrud('browser:createBrowser', createBrowser)
  handleCrud('browser:updateBrowser', updateBrowser)
  handleCrud('browser:deleteBrowser', deleteBrowser)
  handleCrud('browser:getTrash', getTrashBrowsers)
  handleCrud('browser:restore', restoreBrowser)
  handleCrud('browser:permanentDelete', permanentDeleteBrowser)
}
