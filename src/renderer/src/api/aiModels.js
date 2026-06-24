/**
 * @file: AI 模型相关接口
 * @author: dabao
 * @date: 2024-03-15
 */

import request, { createSSE } from './request'

// 获取AI模型列表
export const getModels = () => {
  return request.get('/app/ai/getModels')
}
// 创建聊天流式响应
export const createChatStream = (data, onMessage, onError, onClose) => {
  return createSSE('/app/ai/chat', data, {}, onMessage, onError, onClose)
}
// 获取聊天记录
export const getChatMessages = (params) => {
  return request.get('/app/ai/getChatMessages', { params })
}
// 删除聊天记录
export const deleteChatMessages = (params) => {
  return request.delete('/app/ai/deleteChatMessages', { params })
}
