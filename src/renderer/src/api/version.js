/**
 * @file: 版本更新相关接口
 * @author: dabao
 * @date: 2024-03-15
 */

import request from './request'

// 检查版本更新
export const checkVersion = (version, platform) => {
  return request.get('/app/version/check', { params: { version, platform } })
}
