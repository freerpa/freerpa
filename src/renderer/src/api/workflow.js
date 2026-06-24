/**
 * @file: 工作流相关接口
 * @author: dabao
 * @date: 2024-03-16
 */

import request from './request'

// 获取工作流列表
export const getWorkflows = (params) => {
  return request.get('/app/workflow/list', { params })
}

// 获取工作流详情
export const getWorkflowDetail = (id) => {
  return request.get('/app/workflow/detail', { params: { id } })
}

// 保存工作流
export const saveWorkflow = (data) => {
  return request.post('/app/workflow/save', data)
}

// 删除工作流
export const deleteWorkflow = (id) => {
  return request.delete('/app/workflow/delete', { data: { id } })
}

// 复制工作流
export const copyWorkflow = (id) => {
  return request.post('/app/workflow/copy', { id })
}

//获取导出所需费用
export const getExportWorkflowFee = () => {
  return request.get('/app/workflow/export_fee')
}

// 导出工作流
export const exportWorkflow = (id, type, username) => {
  return request.post('/app/workflow/export', { id, type, username })
}

// 导入工作流
export const importWorkflow = (data, confirm = false) => {
  return request.post('/app/workflow/import', { data, confirm })
}

// 获取工作流依赖
export const getDependencies = (workflowId) => {
  return request.get(`/app/workflow/getDependencies/${workflowId}`)
}
