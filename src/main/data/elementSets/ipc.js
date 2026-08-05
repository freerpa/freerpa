import { handleCrud } from '../ipcHelper.js'
import {
  getElementSets, getElementSet, createElementSet, updateElementSet,
  deleteElementSet, getTrashElementSets, restoreElementSet, permanentDeleteElementSet
} from './index.js'

export const register = () => {
  handleCrud('elementSet:getElementSets', getElementSets)
  handleCrud('elementSet:getElementSet', getElementSet)
  handleCrud('elementSet:createElementSet', createElementSet)
  handleCrud('elementSet:updateElementSet', updateElementSet)
  handleCrud('elementSet:deleteElementSet', deleteElementSet)
  handleCrud('elementSet:getTrash', getTrashElementSets)
  handleCrud('elementSet:restore', restoreElementSet)
  handleCrud('elementSet:permanentDelete', permanentDeleteElementSet)
}
