/**
 * @file: 网络请求节点执行器
 */
import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
const execute = async ({ config }, context) => {
  
  const {
    url,
    method,
    headers,
    bodyType,
    bodyFormData,
    bodyFormFiles,
    bodyText,
    timeout,
    proxyUrl
  } = config
  const { complete, fs } = context

  // 使用网络监听的请求信息
  let finalUrl = url
  if (!finalUrl.startsWith('http')) {
    finalUrl = `http://${finalUrl}`
  }
  let finalMethod = method
  let finalHeaders = {}

  if (Array.isArray(headers)) {
    finalHeaders = Object.fromEntries(headers.filter((item) => item.key && item.value).map((item) => [item.key, item.value])) || {}
  } else if (typeof headers === 'object') {
    finalHeaders = headers || {}
  } else if (typeof headers === 'string') {
    try {
      finalHeaders = JSON.parse(headers) || {}
    } catch (error) {
      console.error('解析headers失败:', error)
    }
  }

  let finalBody = null
  // 处理请求体
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(finalMethod)) {
    if (['json', 'xml', 'javascript'].includes(bodyType)) {
      finalHeaders['Content-Type'] = `application/${bodyType}`
      finalBody = bodyText || ''
    } else if (['plain', 'html'].includes(bodyType)) {
      finalHeaders['Content-Type'] = `text/${bodyType}`
      finalBody = bodyText || ''
    } else if (bodyType === 'form-data') {
      finalHeaders['Content-Type'] = 'multipart/form-data'
      const formData = new FormData()
      if (Array.isArray(bodyFormData) && bodyFormData.length > 0) {
        const bodyForm = bodyFormData.map((item) => {
          return {
            key: item.key,
            value: item.value
          }

        })
        bodyForm.forEach((item) => {
          formData.append(item.key, item.value)
        })
      } else if (Object.prototype.toString.call(bodyFormData) === '[object Object]') {
        Object.keys(bodyFormData).forEach((key) => {
          formData.append(key, bodyFormData[key])
        })
      }
      if (Array.isArray(bodyFormFiles) && bodyFormFiles.length > 0) {
        const bodyFiles = bodyFormFiles.map((item) => {
          return {
            key: item.key,
            value: new File([fs.readFileSync(item.file)], item.file.split('\\').pop())
          }
        })
        bodyFiles.forEach((item) => {
          formData.append(item.key, item.value)
        })
      } else if (Object.prototype.toString.call(bodyFormFiles) === '[object Object]') {
        Object.keys(bodyFormFiles).forEach((key) => {
          formData.append(key, bodyFormFiles[key])
        })
      }
      finalBody = formData
    } else if (bodyType === 'urlencoded') {
      finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
      if (Array.isArray(bodyFormData) && bodyFormData.length > 0) {
        finalBody = bodyFormData
          .map((item) => {
            return `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`
          })
          .join('&')
      } else if (Object.prototype.toString.call(bodyFormData) === '[object Object]') {
        finalBody = Object.keys(bodyFormData)
          .map((key) => {
            return `${encodeURIComponent(key)}=${encodeURIComponent(bodyFormData[key])}`
          })
          .join('&')
      } else if (typeof bodyFormData === 'string') {
        finalBody = bodyFormData
      } else {
        finalBody = ''
      }
    }
  }
  if (!finalHeaders.hasOwnProperty('Host')) {
    finalHeaders['Host'] = new URL(finalUrl).host
  }
  if (!finalHeaders.hasOwnProperty('Connection')) {
    finalHeaders['Connection'] = 'keep-alive'
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
  if (proxyUrl) {
    let proxyServer = proxyUrl.trim().toLowerCase()
    // 解析代理配置
    const proxyProtocol = ['http:', 'https:', 'socks4:', 'socks5:']
    // 检查代理协议是否正确
    if (!proxyProtocol.some(protocol => proxyServer.startsWith(protocol))) {
      proxyServer = `http://${proxyServer}`
    }
    // 检查代理协议是否为socks
    if (proxyServer.startsWith('socks')) {
      const agent = new SocksProxyAgent(proxyServer)
      axiosConfig.httpAgent = agent
      axiosConfig.httpsAgent = agent
    } else {
      const agent = new HttpsProxyAgent(proxyServer)
      axiosConfig.httpAgent = agent
      axiosConfig.httpsAgent = agent
    }
  }

  // 处理json类型的body
  // if (finalHeaders['Content-Type'].includes('json') && typeof finalBody === 'string') {
  //   console.error('finalBody',finalBody);
  //   finalBody = JSON.stringify(JSON.parse(finalBody))
  // }

  // 处理不同请求方法的body
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(finalMethod) && finalBody) {
    axiosConfig.data = finalBody
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

}
export default execute
