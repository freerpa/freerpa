/**
 * @file: 请求工具类
 * @author: dabao
 * @date: 2024-03-15
 */

import axios from 'axios'
import { API_CONFIG } from '@renderer/api/config'
import { BaseWindow } from 'electron'
import { encryptedData, decryptedData } from './ipc'

// 获取token
export const getToken = async () => {
  const win = BaseWindow.getAllWindows().find((win) => win.id === 1)
  const rendererStorage =
    await win.contentView.children[0].webContents.executeJavaScript('localStorage')
  const token = rendererStorage.token
  const expires = rendererStorage.token_expires
  const userId = rendererStorage.userId

  if (!token || !expires || !userId) {
    return null
  }

  // 检查是否过期
  if (Date.now() >= Number(expires)) {
    return null
  }

  return token
}

// 创建axios实例
const request = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS
})

// 请求拦截器
request.interceptors.request.use(
  async (config) => {
    config.data = await encryptedData(config.data)
    const token = await getToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    // 如果是FormData格式，确保不要覆盖Content-Type
    if (config.data instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data'
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    const res = decryptedData(response.data)

    if (res.code === 200) {
      return res.data
    } else if (res.code === 401 || res.code === 403) {
      return Promise.reject(res.message || '请重新登录')
    }
    return Promise.reject(res.message || '请求失败')
  },
  (error) => {
    return Promise.reject(error)
  }
)

export default request
