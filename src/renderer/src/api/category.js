/**
 * @file: 分类相关接口
 * @author: dabao
 * @date: 2024-03-15
 */

import request from './request'
// 添加分类
export const addCategory = (type, name) => {
  return request.post('/app/category', {
    type,
    name
  })
}
// 获取分类列表
export const getCategoryList = (type) => {
  return request.get('/app/category', {
    params: {
      type
    }
  })
}
// 获取分类详情
export const getCategory = (id) => {
  return request.get(`/app/category/${id}`)
}
// 删除分类
export const deleteCategory = (id) => {
  return request.delete(`/app/category/${id}`)
}
// 更新分类
export const updateCategory = (id, name) => {
  return request.put(`/app/category/${id}`, {
    name
  })
}
