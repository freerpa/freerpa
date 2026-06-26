/**
 * @file: 浏览器相关接口
 * @author: dabao
 * @date: 2024-03-16
 */

import request from './request'

// 获取浏览器列表
export const getEnvironments = params => {
  return request.get('/app/environment/list', { params })
}

// 获取浏览器详情
export const getEnvironmentDetail = id => {
  return request.get('/app/environment/detail', { params: { id } })
}

// 保存浏览器
export const saveEnvironment = data => {
  return request.post('/app/environment/save', data)
}

// 删除浏览器
export const deleteEnvironment = id => {
  return request.delete('/app/environment/delete', { data: { id } })
} 