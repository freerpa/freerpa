import { handleCrud } from '../ipcHelper.js'
import { getCategories, addCategory, updateCategory, deleteCategory } from './index'

export const register = () => {
  handleCrud('category:getCategories', getCategories)
  handleCrud('category:addCategory', addCategory)
  handleCrud('category:updateCategory', updateCategory)
  handleCrud('category:deleteCategory', deleteCategory)
}
