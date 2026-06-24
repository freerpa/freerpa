/**
 * @file: 网络请求节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

import { page_eval } from '@pageEval'
const execute = async ({ inputs, config }, context) => {
  try {
    const { page, request } = inputs
    const { url, method, headers, body } = config
    const { complete } = context

    // 使用网络监听的请求信息
    let finalUrl = url
    let finalMethod = method
    let finalHeaders = headers || []
    let finalBody = Object.fromEntries(body.map((item) => [item.key, item.value]))

    // 将 headers 转换为对象
    finalHeaders = Object.fromEntries(finalHeaders.map((item) => [item.key, item.value]))

    if (request) {
      finalUrl = request.url || url
      finalMethod = request.method || method
      finalHeaders = { ...request.headers, ...finalHeaders }
      finalBody = request.postData || finalBody
    }

    // 输出请求信息
    let response

    if (page) {
      // 使用浏览器上下文发送请求
      response = await page_eval(
        page,
        `(url, method, headers, body) => {
          const options = {
            method,
            headers
          }
          //如果GET或者HEAD方法，不包含body
          if (!['GET', 'HEAD'].includes(method)) {
            options.body = body
          }
          const res = await fetch(url, options)
          const responseData = await res.text()
          let data
          try {
            data = JSON.parse(responseData)
          } catch {
            data = responseData
          }

          return {
            status: res.status,
            statusText: res.statusText,
            headers: Object.fromEntries(res.headers.entries()),
            data
          }
        }`,
        finalUrl,
        finalMethod,
        finalHeaders,
        finalBody
      )
    } else {
      const options = {
        method: finalMethod,
        headers: finalHeaders
      }
      if (['POST', 'PUT', 'PATCH'].includes(finalMethod)) {
        options.body = finalBody
      }
      // 使用 Node.js 发送请求
      const res = await fetch(finalUrl, options)

      let data = null
      //根据响应头的Content-Type判断应该读取为文本还是二进制数据
      if (res.headers.get('Content-Type').includes('application/json')) {
        const responseData = await res.text()
        try {
          data = JSON.parse(responseData)
        } catch {
          data = responseData
        }
      } else {
        const arrayBuffer = await res.arrayBuffer()
        // 2. 转换为Node.js的Buffer（更方便处理二进制）
        data = Buffer.from(arrayBuffer)
      }

      response = {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        data: data
      }
    }

    const output = {
      url: finalUrl,
      statusCode: response.status,
      response,
      responseData: response.data
    }
    // 输出响应结果
    complete(output)
  } catch (error) {
    throw error
  }
}
export default execute
