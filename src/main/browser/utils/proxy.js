import http from 'http'
import https from 'https'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { getIpInfo } from './ip'

/**
 * 从标准代理地址中提取 IPv4 地址
 */
export const extractIpFromProxy = (proxyUrl) => {
  if (typeof proxyUrl !== 'string' || proxyUrl.trim() === '') {
    return ''
  }

  const ipv4Regex = /(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)/
  const matchResult = proxyUrl.match(ipv4Regex)

  if (!matchResult) {
    return ''
  }

  const ip = matchResult[0]
  const ipSegments = ip.split('.')
  const isLegalIpv4 = ipSegments.every(segment => {
    const num = parseInt(segment, 10)
    return !isNaN(num) && num >= 0 && num <= 255
  })

  if (!isLegalIpv4) {
    return ''
  }

  return ip
}

/**
 * 验证代理是否有效
 */
export async function validateProxy(proxyUrl, options = {}) {
  const {
    timeout = 5000,
    testUrl = 'https://httpbin.org/ip'
  } = options

  try {
    const isHttpsTestUrl = testUrl.startsWith('https')
    const requestModule = isHttpsTestUrl ? https : http

    let agent
    if (proxyUrl.startsWith('http')) {
      agent = new HttpsProxyAgent(proxyUrl)
    } else if (proxyUrl.startsWith('socks')) {
      agent = new SocksProxyAgent(proxyUrl)
    } else {
      throw new Error('不支持的代理类型，仅支持 http/https/socks 协议')
    }

    const requestOptions = {
      agent,
      timeout,
      maxRedirects: 0
    }

    const result = await new Promise((resolve, reject) => {
      const req = requestModule.get(testUrl, requestOptions, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const { origin } = JSON.parse(data)
              resolve({ isValid: true, ip: origin })
            } catch (e) {
              reject(new Error('解析测试响应失败: ' + e.message))
            }
          } else {
            reject(new Error(`代理返回异常状态码: ${res.statusCode}`))
          }
        })
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('请求超时'))
      })

      req.on('error', (err) => {
        reject(new Error(`代理连接失败: ${err.message}`))
      })
    })

    const ip = extractIpFromProxy(proxyUrl)
    const ipInfo = await getIpInfo(ip)
    if (ipInfo) {
      result.ipInfo = ipInfo
    }
    return result
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    }
  }
}

/**
 * UUID 转 10 位小数
 */
export const uuidTo10Decimal = (uuid) => {
  const cleanUuid = uuid.replace(/-/g, '').toLowerCase()
  const uuidRegex = /^[0-9a-f]{32}$/
  if (!uuidRegex.test(cleanUuid)) {
    throw new Error('请传入合法的UUID字符串（如：1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed）')
  }

  const uuidBigInt = BigInt(`0x${cleanUuid}`)
  const max10Digit = BigInt(10 ** 10)
  const decimalPart = uuidBigInt % max10Digit
  const decimalStr = decimalPart.toString().padStart(10, '0')
  const result = `0.${decimalStr}`

  return result
}

/**
 * 根据国家编码获取对应的浏览器语言代码
 */
export const getLanguageByCountryCode = (countryCode) => {
  if (typeof countryCode !== 'string' || countryCode.trim() === '') {
    console.warn('国家编码必须是非空字符串')
    return 'en-US'
  }

  const normalizedCode = countryCode.trim().toUpperCase()

  const countryToLanguageMap = {
    CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-HK',
    US: 'en-US', GB: 'en-GB', CA: 'en-CA', AU: 'en-AU',
    JP: 'ja-JP', KR: 'ko-KR', DE: 'de-DE', FR: 'fr-FR',
    ES: 'es-ES', MX: 'es-MX', IT: 'it-IT', RU: 'ru-RU',
    BR: 'pt-BR', PT: 'pt-PT'
  }

  return countryToLanguageMap[normalizedCode] || 'en-US'
}
