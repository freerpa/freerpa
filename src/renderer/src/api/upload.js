/**
 * @file: 上传相关接口
 * @author: dabao
 * @date: 2024-03-15
 */

import request from './request'

// 上传图片
export const uploadImage = (data) => {
  return request.post('/app/upload/image', data, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// 删除图片
export const deleteImage = (data) => {
  return request.delete('/app/upload/delete', data)
}
