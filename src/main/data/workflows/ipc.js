import { handleCrud } from '../ipcHelper.js'
import { getWorkflows, getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow, getTrashWorkflows, restoreWorkflow, permanentDeleteWorkflow } from './index'

export const register = () => {
  handleCrud('workflow:getWorkflows', getWorkflows)
  handleCrud('workflow:getWorkflow', getWorkflow)
  handleCrud('workflow:createWorkflow', createWorkflow)
  handleCrud('workflow:updateWorkflow', updateWorkflow)
  handleCrud('workflow:deleteWorkflow', deleteWorkflow)
  handleCrud('workflow:getTrash', getTrashWorkflows)
  handleCrud('workflow:restore', restoreWorkflow)
  handleCrud('workflow:permanentDelete', permanentDeleteWorkflow)
}
