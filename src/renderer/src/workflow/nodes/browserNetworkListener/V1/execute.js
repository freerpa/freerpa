/**
 * @file: 网络监听节点执行器
 */
import querystring from 'querystring'
import xml2js from 'xml2js'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { next, onBeforeDestroy, complete } = context

  
  const page = inputs.page
  const {
    url = {},
    method = [],
    headers = {},
    body = {},
    resourceTypes = [],
    statusCodes = [],
    responseMatch = {},
    isContinuous = true
  } = config

  // 检查URL是否匹配
  const checkUrl = (requestUrl) => {
    if (!url?.rules.length) return true
    return url.rules[url.mode == 'any' ? 'some' : 'every']((rule) => {
      return compare(requestUrl, rule.type, rule.value)
    })
  }

  // 检查请求方法
  const checkMethod = (reqMethod) => {
    return method.includes(reqMethod)
  }

  // 检查资源类型
  const checkResourceType = (type) => {
    return resourceTypes.includes(type)
  }

  // 检查状态码
  const checkStatusCode = (status) => {
    const statusGroup = Math.floor(status / 100) + 'xx'
    return statusCodes.includes(statusGroup)
  }

  // 检查请求头匹配
  const checkHeaders = (reqHeaders) => {
    if (!headers?.rules.length) return true
    return headers.rules[headers.mode == 'any' ? 'some' : 'every']((rule) => {
      const value = rule.name ? reqHeaders[rule.name.toLowerCase()] : JSON.stringify(reqHeaders)
      const result = compare(value, rule.type, rule.value)
      return result
    })
  }

  const compare = (left, op, right) => {
    let result = false
    switch (op) {
      case 'exists':
        result = left !== undefined
        break
      case 'empty':
        result = !left
        break
      case 'eq':
        result = left == right
        break
      case 'contains':
        result = left.includes(right)
        break
      case 'regex':
        result = new RegExp(right).test(left)
        break
      default:
        result = false
        break
    }
    return result
  }

  // 检查参数匹配
  const checkBody = (data) => {
    if (!body?.rules.length) return true
    console.error('请求体数据:', data);
    return body.rules[body.mode == 'any' ? 'some' : 'every']((rule) => {
      const value = rule.name
        ? rule.name.split('.').reduce((obj, key) => obj?.[key], data)
        : JSON.stringify(data)
      return compare(value, rule.type, rule.value)
    })
  }

  const getBodyData = async (request) => {
    let body = null // 检查请求体参数
    const postData = request.postData()
    if (!postData) {
      console.error('没有请求体数据')
      return false
    }
    const contentType = request.headers()['content-type'] || ''

    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(postData)
      } catch (err) {
        body = postData
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        // 转换为JSON对象
        body = querystring.parse(postData)
        console.error('表单参数值:', body)
      } catch (err) {
        body = postData
      }
    } else if (contentType.includes('application/xml')) {
      try {
        const parser = new xml2js.Parser()
        body = await parser.parseStringPromise(postData)
      } catch (err) {
        body = postData
      }
    }
    return body
  }

  // 检查响应内容是否匹配规则
  const checkResponseMatch = async (responseData) => {
    if (!responseMatch?.rules.length) return true
    try {
      return responseMatch.rules[responseMatch.mode == 'any' ? 'some' : 'every']((rule) => {
        const value = rule.name
          ? rule.name.split('.').reduce((obj, key) => obj?.[key], responseData)
          : JSON.stringify(responseData)
        return compare(value, rule.type, rule.value)
      })
    } catch {
      return false
    }
  }

  // 根据content-type获取responseData
  const getResponseData = async (response) => {
    let responseData = null
    let responseType = response.headers()['content-type']
    //根据所有不同的content-type判断responseData获取方式
    try {
      if (responseType.includes('application/json')) {
        responseData = await response.json()
      } else if (responseType.includes('application/x-www-form-urlencoded')) {
        responseData = await response.text()
        responseData = querystring.parse(responseData)
        console.error('表单参数值:', responseData)
      } else if (responseType.includes('application/xml')) {
        responseData = await response.text()
        const parser = new xml2js.Parser()
        responseData = await parser.parseStringPromise(responseData)
        console.error('XML参数值:', responseData)
      } else if (responseType.startsWith('text/')) {
        responseData = await response.text()
        //如果是sse，则解析成数组
        if (responseType.startsWith('text/event-stream')) {
          responseData = responseData
            .split('\n')
            .map((line) => {
              if (line.startsWith('data:')) {
                return JSON.parse(line.slice(6))
              }
            })
            .filter(Boolean)
        }
      } else {
        responseData = await response.buffer()
      }
      return responseData
    } catch (err) {
      console.warn('响应数据解析失败:', err)
    }
  }

  // 响应处理器
  const responseHandler = async (response) => {
    const request = response.request()
    // 检查URL是否匹配
    if (!checkUrl(request.url())) return
    // 检查请求方法是否匹配
    if (!checkMethod(request.method())) return
    // 检查资源类型是否匹配
    if (!checkResourceType(request.resourceType())) return
    // 检查请求体是否匹配
    const bodyData = await getBodyData(request)
    if (!checkBody(bodyData)) return
    console.error('检查请求体是否匹配:', !checkBody(bodyData), bodyData)
    // 检查请求头是否匹配
    if (!checkHeaders(request.headers())) return
    // 检查状态码是否匹配
    if (!checkStatusCode(response.status())) return
    // 获取响应数据
    let responseData = await getResponseData(response)
    // 检查响应数据是否匹配规则
    if (!(await checkResponseMatch(responseData))) return
    const output = {
      // page,
      request: {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        timestamp: Date.now(),
        resourceType: request.resourceType(),
        isNavigationRequest: request.isNavigationRequest()
      },
      response: {
        url: request.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        data: responseData,
        timestamp: Date.now(),
        fromCache: response.fromCache(),
        fromServiceWorker: response.fromServiceWorker()
      },
      statusCode: response.status(),
      responseData: responseData
    }
    // 发送完整的请求-响应数据
    if (isContinuous) {
      next(output)
    } else {
      complete(output)
      clear()
    }
  }

  // 注册事件监听
  page.on('response', responseHandler)

  // 清理函数
  const clear = () => {
    page.off('response', responseHandler)
  }

  // 注册清理函数
  onBeforeDestroy(() => {
    clear()
  })

}

export default execute
