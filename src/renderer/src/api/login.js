/**
 * @file: 登录相关接口
 * @author: dabao
 * @date: 2024-03-15
 */

import request from './request'
// 获取验证码
export const getCaptcha = () => {
  return request.get('/app/captcha')
}

// 获取手机验证码
export const getPhoneCode = (phone, type, captchaKey, captchaCode) => {
  return request.post('/app/sendPhoneCode', {
    phone,
    type, // login=登录,register=注册,reset=重置密码
    captchaKey,
    captchaCode
  })
}

// 获取邮箱验证码
export const getEmailCode = (email, type) => {
  return request.post('/app/sendEmailCode', {
    email,
    type // login=登录,register=注册,reset=重置密码
  })
}

// 获取微信登录二维码
export const getWeChatCode = () => {
  return request.get('/app/getWeChatCode')
}

// 登录
export const login = (data) => {
  return request.post('/app/login', data)
}

// 邮箱登录
export const loginByEmail = (data) => {
  return request.post('/app/loginByEmail', data)
}

// 微信登录
export const loginByWeChat = (data) => {
  return request.post('/app/loginByWeChat', data)
}

// 退出登录
export const logout = () => {
  return request.post('/app/logout')
}

// 注册
export const register = (data) => {
  return request.post('/app/register', data)
}

// 重置密码
export const resetPassword = (data) => {
  return request.post('/app/resetPassword', data)
}

// 获取用户协议
export const getUserAgreement = () => {
  return request.get('/app/userAgreement')
}

// 获取客服信息
export const getCustomerService = () => {
  return request.get(`/app/customerService`)
}

// 获取开发者协议
export const getDeveloperAgreement = () => {
  return request.get('/app/developerAgreement')
}

// 获取选择器教程
export const getSelectorTutorial = () => {
  return request.get('/app/selectorTutorial')
}
