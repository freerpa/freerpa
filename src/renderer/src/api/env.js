/**
 * @file: 环境相关接口
 * @author: dabao
 * @date: 2024-03-16
 */

import request from './request'

// 获取环境列表
export const getEnvironments = params => {
  return request.get('/app/environment/list', { params })
}

// 获取环境详情
export const getEnvironmentDetail = id => {
  return request.get('/app/environment/detail', { params: { id } })
}

// 保存环境
export const saveEnvironment = data => {
  return request.post('/app/environment/save', data)
}

// 删除环境
export const deleteEnvironment = id => {
  return request.delete('/app/environment/delete', { data: { id } })
} 