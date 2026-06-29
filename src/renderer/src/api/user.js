/**
 * @file: 用户相关接口
 * @author: dabao
 * @date: 2024-03-15
 */

import request from './request'

// 获取个人资料
export const getProfile = () => {
  return request.get('/app/user/profile')
}

// 更新个人资料
export const updateProfile = (data) => {
  return request.post('/app/user/updateProfile', data)
}

// 修改密码
export const updatePassword = (data) => {
  return request.post('/app/user/updatePassword', data)
}

// 绑定手机
export const bindPhone = (data) => {
  return request.post('/app/user/bindPhone', data)
}

// 获取充值方式
export const getRechargeInfo = () => {
  return request.get('/app/user/recharge')
}

// 获取用户积分变动记录
export const getPointsLog = (page, pageSize) => {
  return request.get(`/app/user/points/log`, { params: { page, pageSize } })
}

// 使用兑换码
export const useExchangeCode = (data) => {
  return request.post(`/app/user/code/use`, data)
}

// 获取用户反馈列表
export const getFeedbackList = (page, limit) => {
  return request.get(`/app/feedback/list`, { params: { page, limit } })
}

// 新增用户反馈
export const addFeedback = (data) => {
  return request.post(`/app/feedback/add`, data)
}
