/**
 * @file: 网络请求节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'

const execute = async ({ config }, context) => {
  try {
    const {
      url,
      method,
      headers,
      cookie,
      body,
      timeout,
      authType,
      username,
      password,
      token,
      proxy
    } = config
    const { complete, fs } = context

    // 使用网络监听的请求信息
    let finalUrl = url
    let finalMethod = method
    let finalHeaders = Object.fromEntries(headers.map((item) => [item.key, item.value])) || {}
    let finalBody = null

    // 处理Cookie
    if (cookie && cookie.length > 0) {
      finalHeaders['Cookie'] = cookie.map((item) => `${item.key}=${item.value}`).join('; ')
    }

    // 处理请求体
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(finalMethod)) {
      if (['json', 'xml', 'javascript'].includes(body?.type)) {
        finalHeaders['Content-Type'] = `application/${body.type}`
        finalBody = body.text || ''
      } else if (['plain', 'html'].includes(body?.type)) {
        finalHeaders['Content-Type'] = `text/${body.type}`
        finalBody = body.text || ''
      } else if (body?.type === 'form-data') {
        finalHeaders['Content-Type'] = 'multipart/form-data'
        const formData = new FormData()
        const bodyForm = body.form.map((item) => {
          if (item.type === 'file') {
            return {
              key: item.key,
              value: new File([fs.readFileSync(item.file)], item.file.split('\\').pop())
            }
          } else if (item.type === 'text') {
            return {
              key: item.key,
              value: item.value
            }
          }
        })
        bodyForm.forEach((item) => {
          formData.append(item.key, item.value)
        })
        finalBody = formData
      } else if (body?.type === 'urlencoded') {
        finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
        finalBody = body.form
          .map((item) => {
            ;`${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`
          })
          .join('&')
      }
    }
    // 处理认证
    if (authType === 'basic' && username && password) {
      const credentials = btoa(`${username}:${password}`)
      finalHeaders['Authorization'] = `Basic ${credentials}`
    } else if (authType === 'bearer' && token) {
      finalHeaders['Authorization'] = `Bearer ${token}`
    }

    // 发送请求
    const axiosConfig = {
      method: finalMethod,
      url: finalUrl,
      headers: { ...finalHeaders },
      timeout: timeout || 30000, // 设置超时
      maxRedirects: 5, // 自动跟随重定向
      validateStatus: () => true, // 不自动拒绝任何状态码
      withCredentials: true,
      responseType: 'arraybuffer'
    }

    // 处理代理
    if (proxy && proxy.enable) {
      const { protocol, host, port, username, password } = proxy
      const agent = new HttpsProxyAgent(`${protocol}://${username}:${password}@${host}:${port}`)
      axiosConfig.httpAgent = agent
      axiosConfig.httpsAgent = agent
    }

    // 处理不同请求方法的body
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(finalMethod) && finalBody) {
      axiosConfig.data = finalBody
    }

    // 添加认证头
    if (authType === 'basic' && username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64')
      axiosConfig.headers['Authorization'] = `Basic ${credentials}`
    } else if (authType === 'bearer' && token) {
      axiosConfig.headers['Authorization'] = `Bearer ${token}`
    }

    const res = await axios(axiosConfig)

    // 解析响应数据
    let data = null
    const contentType = res.headers['content-type'] || ''
    if (contentType.includes('json')) {
      const jsonString = new TextDecoder().decode(res.data)
      data = JSON.parse(jsonString)
    } else if (
      contentType.includes('text') ||
      contentType.includes('xml') ||
      contentType.includes('html')
    ) {
      data = res.data.toString()
    } else {
      // 二进制数据
      data = res.data
    }

    const response = {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      data: data
    }

    // 准备输出结果
    const output = {
      url: finalUrl,
      statusCode: response.status,
      response: response,
      responseData: response.data
    }

    // 输出响应结果
    complete(output)
  } catch (error) {
    throw error
  }
}
export default execute
