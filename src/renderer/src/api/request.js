/**
 * @file: 请求工具类
 * @author: dabao
 * @date: 2024-03-15
 */

import axios from 'axios'
import { Message } from '@arco-design/web-vue'
import { API_CONFIG } from './config'
import router from '@/router'
import { getToken } from '@/utils/token'
import pkg from '../../../../package.json'
const version = pkg.version

const errMsg = (msg = '') => {
  Message.error({
    id: msg,
    content: msg,
    duration: 3000
  })
}


// 创建axios实例
const request = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
})

export function createSSE(url, data, options = {}, onMessage, onError, onClose) {
  const fetchUrl = `${API_CONFIG.BASE_URL}${url}`
  const controller = new AbortController();
  const signal = controller.signal;
  const start = async () => {

    const headers = {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...options.headers,
    }
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    headers['app-version'] = version
    try {
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: await window.electronAPI.api.encrypt(data),
        signal,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // 读取流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码并解析 SSE 消息
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        lines.forEach(line => {
          line = line.trim();
          if (line.startsWith('data:')) {
            const data = line.substring(5).trim();
            if (data === '[DONE]') {
              controller.abort();
              return;
            }
            if (!data) {
              return;
            }
            try {
              onMessage?.(JSON.parse(data));
            } catch (e) {
              onMessage?.(data);
            }
          }
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.(err);
      }
    } finally {
      onClose?.();
    }

  }

  const abort = () => {
    controller.abort()
  }
  // 返回取消函数
  return {
    start,
    abort
  }
}

// 请求拦截器
request.interceptors.request.use(
  async (config) => {
    const token = getToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    config.headers['app-version'] = version
    // 如果是FormData格式，确保不要覆盖Content-Type
    if (config.data instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data'
    } else {
      config.data = await window.electronAPI.api.encrypt(config.data)
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  async (response) => {
    if (response.config.responseType === 'stream') {
      return response.data
    }
    const res = await window.electronAPI.api.decrypt(response.data)
    if (res.code === 200) {
      return res.data
    } else if (res.code === 401 || res.code === 403) {
      router.replace('/login')
      errMsg(res.message || '请重新登录')
      return Promise.reject(new Error(res.message || '请重新登录'))
    }
    errMsg(res.message || '请求失败')
    return Promise.reject(new Error(res.message || '请求失败'))
  },
  (error) => {
    if (error.response?.status === 401) {
      router.replace('/login')
      errMsg('请重新登录')
    } else {
      errMsg(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default request
