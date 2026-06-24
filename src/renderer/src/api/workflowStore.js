/**
 * @file: 工作流相关接口
 * @author: dabao
 * @date: 2024-03-16
 */

import request from './request'

// 获取工作流详情
export const getStoreWorkflowDetail = (id) => {
  return request.get(`/app/workflowStore/detail?id=${id}`)
}

// 举报工作流
export const reportStoreWorkflow = (data) => {
  return request.post('/app/workflowStoreReport/submit', data)
}

// 获取我的举报
export const getMyReports = (data) => {
  return request.get('/app/workflowStoreReport/myReports', { params: data })
}

// 购买工作流
export const purchaseStoreWorkflow = (data) => {
  return request.post('/app/workflowStore/purchase', data)
}

// 使用工作流
export const useStoreWorkflow = (data) => {
  return request.post('/app/workflowStore/use', data)
}

// 我的兑换
export const getMyPurchases = (data) => {
  return request.get('/app/workflowStore/myPurchase', { params: data })
}

// 我的发布
export const getMyPublish = (data) => {
  return request.get('/app/workflowStore/myPublish', { params: data })
}

// 下架工作流
export const downStoreWorkflow = (data) => {
  return request.post('/app/workflowStore/down', data)
}

// 上架工作流
export const upStoreWorkflow = (data) => {
  return request.post('/app/workflowStore/up', data)
}

// 获取工作流市场列表
export const getStoreWorkflows = (data) => {
  return request.get('/app/workflowStore/list', { params: data })
}

// 获取工作流市场分类列表
export const getStoreWorkflowCategories = (data) => {
  return request.get('/app/workflowCategory/list', { params: data })
}

// 获取工作流市场Banner列表
export const getBanners = (data) => {
  return request.get('/app/banner/list', { params: data })
}

// 获取工作流市场公告列表
export const getNotices = (data) => {
  return request.get('/app/notice/list', { params: data })
}

// 获取工作流市场公告详情
export const getNoticeDetail = (data) => {
  return request.get('/app/notice/detail', { params: data })
}

// 发布工作流
export const publishWorkflow = (data) => {
  return request.post('/app/workflowStore/publish', data)
}

// 删除工作流
export const deleteWorkflow = (data) => {
  return request.post('/app/workflowStore/delete', data)
}
