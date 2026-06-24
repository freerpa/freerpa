/**
 * @file: API配置文件
 * @author: dabao
 * @date: 2024-03-15
 */

// API基础配置
export const API_CONFIG = {
  // API基础路径
  BASE_URL:
    process.env.NODE_ENV === 'development'
      ? import.meta.env.VITE_DEV_URL
      : import.meta.env.VITE_PROD_URL,
  // 超时时间
  TIMEOUT: 10000,
  // 请求头
  HEADERS: {
    'Content-Type': 'application/json'
  }
}
