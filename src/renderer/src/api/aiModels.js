/**
 * @file: AI 模型接口 (离线版本 - 暂不可用)
 */

import { Message } from '@arco-design/web-vue'

// 获取AI模型列表（离线模式返回空）
export const getModels = () => {
  return Promise.resolve([])
}

// 创建聊天流式响应（离线模式不可用）
export const createChatStream = (_data, _onMessage, onError) => {
  if (onError) {
    onError(new Error('离线模式：AI 对话功能暂未配置，请先连接本地 AI 模型（如 Ollama）'))
  }
  return { start: () => {}, abort: () => {} }
}

// 获取聊天记录（离线模式返回空）
export const getChatMessages = () => {
  return Promise.resolve([])
}

// 删除聊天记录
export const deleteChatMessages = () => {
  return Promise.resolve()
}
