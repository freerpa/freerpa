/**
 * @file: 请求工具类 (离线版本 - 仅保留基本结构)
 */

import axios from 'axios'

// 创建axios实例（不再需要远程API，保留用于本地HTTP服务调用）
const request = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export default request
