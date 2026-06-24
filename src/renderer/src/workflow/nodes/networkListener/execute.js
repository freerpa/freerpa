/**
 * @file: 网络监听节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
const execute = async (node, context) => {
  const { inputs, config } = node
  const { next, onBeforeDestroy, complete } = context

  try {
    const page = inputs.page
    const {
      url = {},
      method = 'ALL',
      headers = [],
      params = [],
      resourceTypes = ['ALL'],
      statusCodes = ['ALL'],
      responseMatch = [],
      isContinuous = true
    } = config

    // 检查URL是否匹配
    const checkUrl = (requestUrl) => {
      if (!url.value) return true

      switch (url.type) {
        case 'exact':
          return requestUrl === url.value
        case 'contains':
          return requestUrl.includes(url.value)
        case 'regex':
          return new RegExp(url.value).test(requestUrl)
        case 'wildcard':
          const pattern = url.value.replace(/\*/g, '.*')
          return new RegExp(`^${pattern}$`).test(requestUrl)
        default:
          return true
      }
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
      if (!headers.length) return true

      return headers.every((header) => {
        const value = reqHeaders[header.name.toLowerCase()]
        if (!value) return false

        switch (header.type) {
          case 'exact':
            return value === header.value
          case 'contains':
            return value.includes(header.value)
          case 'regex':
            return new RegExp(header.value).test(value)
          default:
            return false
        }
      })
    }

    // 检查参数匹配
    const checkParams = (request) => {
      if (!params.length) return true

      return params.every((param) => {
        let value = null
        // 检查请求体参数
        const postData = request.postData()
        if (!postData) {
          console.log('没有请求体数据')
          return false
        }

        const contentType = request.headers()['content-type'] || ''

        if (contentType.includes('application/json')) {
          try {
            const body = JSON.parse(postData)
            value = param.name.split('.').reduce((obj, key) => obj?.[key], body)
          } catch (err) {
            console.log('解析JSON失败:', err)
            return false
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          try {
            const formData = new URLSearchParams(postData)
            value = formData.get(param.name)
            console.log('表单参数值:', value)
          } catch (err) {
            console.log('解析表单数据失败:', err)
            return false
          }
        }
        // 暂时移除其他格式的处理,专注于最常见的两种格式

        if (value == null) {
          console.log('未找到参数值')
          return false
        }

        const strValue = String(value).trim()
        const strParamValue = String(param.value).trim()

        let result = false
        switch (param.type) {
          case 'exact':
            result = strValue === strParamValue
            break
          case 'contains':
            result = strValue.includes(strParamValue)
            break
          case 'regex':
            result = new RegExp(strParamValue).test(strValue)
            break
        }
        return result
      })
    }

    // 检查响应内容是否匹配规则
    const checkResponseMatch = async (responseData) => {
      if (!responseMatch.length) return true
      try {
        return responseMatch.every((rule) => {
          const value = rule.field.split('.').reduce((obj, key) => obj?.[key], responseData)
          if (value === undefined) return false

          switch (rule.operator) {
            case 'eq':
              return value === rule.value
            case 'ne':
              return value !== rule.value
            case 'contains':
              return String(value).includes(rule.value)
            case 'regex':
              return new RegExp(rule.value).test(String(value))
            case 'gt':
              return Number(value) > Number(rule.value)
            case 'lt':
              return Number(value) < Number(rule.value)
            case 'gte':
              return Number(value) >= Number(rule.value)
            case 'lte':
              return Number(value) <= Number(rule.value)
            case 'empty':
              return !value
            case 'notEmpty':
              return !!value
            default:
              return false
          }
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
      // 检查请求参数是否匹配
      if (!checkParams(request)) return
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
  } catch (error) {
    throw error
  }
}

export default execute
