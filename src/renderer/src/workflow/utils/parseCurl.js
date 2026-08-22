
// 辅助函数：去除字符串两端的引号（单/双引号）
function trimQuotes(str) {
  if (!str) return str
  const first = str[0]
  const last = str[str.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return str.slice(1, -1)
  }
  return str
}

// 辅助函数：解析转义字符（\" -> ", \' -> ', \\ -> \）
function resolveEscapes(str) {
  return str.replace(/\\(["'\\])/g, '$1')
}

// 辅助函数：UTF-8 安全 base64（btoa 仅 Latin-1，中文 Basic 认证会抛错）
function toBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

// 辅助函数：解析Cookie字符串为键值对
function parseCookies(cookieStr) {
  const cookies = {}
  if (!cookieStr) return cookies
  cookieStr.split(';').forEach(pair => {
    const [key, value] = pair.split('=').map(item => item.trim())
    if (key) cookies[key] = value || ''
  })
  return cookies
}

export function parseCurl(curlCommand) {
  // 1. 预处理：清除换行和Windows命令行转义符，保留字符串内转义符
  let cleaned = curlCommand
    .replace(/\r?\n/g, ' ') // 去除换行
    .replace(/\^/g, '') // 去除Windows的^换行转义
    .replace(/\\\s+/g, ' ') // 处理反斜杠转义的空格
    .trim()

  // 2. 提取curl主体（去掉开头的'curl'）
  const curlIndex = cleaned.indexOf('curl')
  if (curlIndex !== -1) {
    cleaned = cleaned.slice(curlIndex + 4).trim()
  }

  // 3. 初始化结果
  const result = {
    method: 'GET',
    url: '',
    headers: {},
    body: null,
    cookies: {}, // 拆分后的cookie键值对
    insecure: false,
    compressed: false,
    user: null, // 基础认证信息
    proxy: null, // 代理配置
    formData: null, // 表单上传数据
    followRedirect: false, // 是否跟随重定向
    outputFile: null, // 输出文件
  }


  // 4. 分割token（保留引号内完整内容）
  const tokens = []
  let currentToken = ''
  let inQuotes = null // 记录当前引号类型（' 或 "）
  let isEscaped = false // 转义符标记

  for (const char of cleaned) {
    if (isEscaped) {
      currentToken += char
      isEscaped = false
      continue
    }

    if (char === '\\') {
      isEscaped = true
      currentToken += char // 保留转义符供后续处理
      continue
    }

    if (char === '"' || char === "'") {
      if (inQuotes === char) {
        inQuotes = null // 闭合引号
        currentToken += char
      } else if (inQuotes === null) {
        inQuotes = char // 开启引号
        currentToken += char
      } else {
        currentToken += char // 不同引号视为普通字符
      }
    } else if (char === ' ' && inQuotes === null) {
      // 空格且不在引号中时分割token
      if (currentToken) {
        tokens.push(currentToken)
        currentToken = ''
      }
    } else {
      currentToken += char
    }
  }
  if (currentToken) tokens.push(currentToken)

  // 5. 解析tokens
  let urlExtracted = false
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    if (token.startsWith('-')) {
      // 处理选项
      switch (token) {
        // 头部相关
        case '-H':
        case '--header': {
          i++
          let headerStr = tokens[i] || ''
          headerStr = trimQuotes(headerStr)
          headerStr = resolveEscapes(headerStr)
          const colonIndex = headerStr.indexOf(':')
          if (colonIndex !== -1) {
            const key = headerStr.slice(0, colonIndex).trim().toLowerCase()
            const value = headerStr.slice(colonIndex + 1).trim()
            // 处理重复头部（合并为数组）
            if (result.headers[key]) {
              result.headers[key] = Array.isArray(result.headers[key])
                ? [...result.headers[key], value]
                : [result.headers[key], value]
            } else {
              result.headers[key] = value
            }
          }
          break
        }

        // 请求方法
        case '-X':
        case '--request': {
          i++
          result.method = (tokens[i] || '').toUpperCase()
          break
        }

        // Cookie相关
        case '-b':
        case '--cookie': {
          i++
          let cookieStr = tokens[i] || ''
          cookieStr = trimQuotes(cookieStr)
          cookieStr = resolveEscapes(cookieStr)
          result.headers['cookie'] = cookieStr
          result.cookies = parseCookies(cookieStr)
          break
        }

        // 基础认证
        case '-u':
        case '--user': {
          i++
          let userStr = tokens[i] || ''
          userStr = trimQuotes(userStr)
          userStr = resolveEscapes(userStr)
          result.user = userStr
          // 自动添加Authorization头（Base64编码）
          const [user, pass] = userStr.split(':')
          if (user) {
            result.headers['authorization'] = `Basic ${toBase64(`${user}:${pass || ''}`)}`
          }
          break
        }

        // 代理设置
        case '-x':
        case '--proxy': {
          i++
          let proxyStr = tokens[i] || ''
          proxyStr = trimQuotes(proxyStr)
          proxyStr = resolveEscapes(proxyStr)
          result.proxy = proxyStr
          break
        }

        // 表单上传
        case '-F':
        case '--form': {
          i++
          let formStr = tokens[i] || ''
          formStr = trimQuotes(formStr)
          formStr = resolveEscapes(formStr)
          if (!result.formData) result.formData = {}
          // 格式：name=value 或 name=@file
          const [key, value] = formStr.split('=').map(item => item.trim())
          if (key) {
            result.formData[key] = value || ''
          }
          // 自动设置Content-Type和请求方法
          result.headers['content-type'] = 'multipart/form-data'
          result.method = 'POST'
          break
        }

        // 数据发送（支持多次数据拼接）
        case '-d':
        case '--data':
        case '--data-binary':
        case '--data-raw':
        case '--data-urlencode': {
          i++
          let data = tokens[i] || ''
          data = trimQuotes(data)
          data = resolveEscapes(data)
          // 处理urlencode数据
          if (token === '--data-urlencode') {
            data = decodeURIComponent(data)
          }
          result.body = result.body ? `${result.body}&${data}` : data
          break
        }

        // 跟随重定向
        case '-L':
        case '--location':
          result.followRedirect = true
          break

        // 输出文件
        case '-o':
        case '--output': {
          i++
          let fileStr = tokens[i] || ''
          fileStr = trimQuotes(fileStr)
          fileStr = resolveEscapes(fileStr)
          result.outputFile = fileStr
          break
        }

        // 其他标记
        case '-k':
        case '--insecure':
          result.insecure = true
          break
        case '--compressed':
          result.compressed = true
          break

        // 忽略未处理的选项（可根据需要扩展）
        default:
          // 处理长选项（如--connect-timeout）
          if (token.startsWith('--')) {
            // 跳过带参数的长选项
            if (['--connect-timeout', '--max-time', '--retry'].includes(token)) {
              i++
            }
          }
          break
      }
    } else if (!urlExtracted) {
      // 处理URL（可能被引号包裹）
      result.url = trimQuotes(token)
      result.url = resolveEscapes(result.url)
      urlExtracted = true
    }

    i++
  }

  // 6. 处理body和请求方法的自动修正
  if (result.formData) {
    // 表单数据优先于普通body
    result.body = result.formData
  }
  
  // 自动修正请求方法
  if ((result.body !== null || result.formData) && ['GET', 'HEAD'].includes(result.method)) {
    result.method = 'POST'
  }

  // 7. 处理Content-Type自动推断
  if (!result.headers['content-type']) {
    if (result.formData) {
      result.headers['content-type'] = 'multipart/form-data'
    } else if (typeof result.body === 'object') {
      result.headers['content-type'] = 'application/json'
    } else if (result.body) {
      result.headers['content-type'] = 'application/x-www-form-urlencoded'
    }
  }

  return result
}