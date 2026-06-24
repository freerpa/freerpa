/**
 * @file: 版本管理工具类
 * @author: dabao
 * @date: 2024-03-16
 */

import { checkVersion } from '@/api/version'
import pkg from '../../../../package.json'

// 获取当前版本
export const getAppVersion = () => {
  return pkg.version
}

// 检查更新
export const checkUpdate = async () => {
  try {
    //获取平台标识
    const platform = await window.electronAPI.app.getPlatform()
    const result = await checkVersion(pkg.version, platform)
    return result
  } catch (error) {
    console.error('检查更新失败:', error)
  }
}

// 版本比较
export const compareVersion = (version1, version2) => {
  const v1 = version1.split('.')
  const v2 = version2.split('.')
  const len = Math.max(v1.length, v2.length)
  for (let i = 0; i < len; i++) {
    const num1 = parseInt(v1[i] || '0', 10)
    const num2 = parseInt(v2[i] || '0', 10)
    if (num1 < num2) {
      return -1
    } else if (num1 > num2) {
      return 1
    }
  }
  return 0
}
