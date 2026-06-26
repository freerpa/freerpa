/**
 * @file: 浏览器相关接口
 * @author: dabao
 * @date: 2024-03-16
 */

import request from './request'

// 获取浏览器详情
export const getEnvironmentDetail = id => {
  return request.get('/app/environment/detail', { params: { id } })
}