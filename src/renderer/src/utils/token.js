/**
 * @file: Token工具类
 * @author: dabao
 * @date: 2024-03-15
 */

// token键名
const TOKEN_KEY = 'token'
// token过期时间键名
const EXPIRES_KEY = 'token_expires'

// 保存token
export const setToken = (token, expires) => {
  localStorage.setItem(TOKEN_KEY, token)
  if (expires) {
    // 保存过期时间戳
    localStorage.setItem(EXPIRES_KEY, String(Date.now() + expires * 1000))
  }
}

// 获取token
export const getToken = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  const expires = localStorage.getItem(EXPIRES_KEY)
  const userId = localStorage.getItem("userId")
  
  if (!token || !expires || !userId) {
    return null
  }

  // 检查是否过期
  if (Date.now() >= Number(expires)) {
    removeToken()
    return null
  }

  return token
}

// 移除token
export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRES_KEY)
  localStorage.removeItem("userId")
}

// 检查token是否有效
export const isTokenValid = () => {
  return !!getToken()
} 