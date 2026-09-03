/**
 * @file: 本地 IP 归属地解析（由网站 server/utils/geo.ts 移植，客户端本地直连 GEO 服务，不再桥接）
 * 主进程发起请求（无浏览器 CORS 限制）；支持代理查询（通过代理获取其出口 IP 归属地）。
 */
import http from 'http'
import https from 'https'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

/** GEO 服务请求头：freeipapi/ip.sb 会拒绝默认 UA（302/403），必须携带浏览器 UA */
const GEO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json'
}

/** 平台配置（按优先级排列，前一平台失败自动切换下一平台） */
const platforms = [
  {
    name: 'freeipapi',
    url: 'https://freeipapi.com/api/json',
    normalize: (raw) => ({
      ip: String(raw.ipAddress ?? raw.ip ?? ''),
      countryName: String(raw.countryName ?? ''),
      countryCode: String(raw.countryCode ?? ''),
      regionName: String(raw.regionName ?? ''),
      cityName: String(raw.cityName ?? ''),
      timeZone: Array.isArray(raw.timeZones) ? String(raw.timeZones[0] ?? '') : String(raw.timeZone ?? ''),
      isp: String(raw.asnOrganization ?? raw.as ?? '')
    })
  },
  {
    name: 'ip.sb',
    url: 'https://api.ip.sb/geoip',
    normalize: (raw) => ({
      ip: String(raw.ip ?? ''),
      countryName: String(raw.country ?? ''),
      countryCode: String(raw.country_code ?? ''),
      regionName: String(raw.region ?? ''),
      cityName: String(raw.city ?? ''),
      timeZone: String(raw.timezone ?? ''),
      isp: String(raw.isp ?? raw.organization ?? '')
    })
  },
  {
    name: 'ip-api.com',
    url: 'http://ip-api.com/json',
    normalize: (raw) => ({
      ip: String(raw.query ?? ''),
      countryName: String(raw.country ?? ''),
      countryCode: String(raw.countryCode ?? ''),
      regionName: String(raw.regionName ?? ''),
      cityName: String(raw.city ?? ''),
      timeZone: String(raw.timezone ?? ''),
      isp: String(raw.isp ?? '')
    })
  }
]

/** 是否为私有/保留地址（本地/内网，GEO 无法定位） */
export function isPrivateIp(ip) {
  return (
    !ip ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|::1$|^$)/.test(ip)
  )
}

/** 按代理协议构建 http agent：socks5/socks5h 走 SocksProxyAgent，其余（http/https）走 HttpsProxyAgent */
function buildAgent(proxy) {
  try {
    return /^socks5h?:\/\//i.test(proxy) ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy)
  } catch {
    return null
  }
}

/** 请求单个 GEO 服务并解析 JSON（6s 超时） */
function requestJson(apiUrl, agent) {
  return new Promise((resolve, reject) => {
    const mod = apiUrl.startsWith('https:') ? https : http
    const req = mod.get(apiUrl, { headers: GEO_HEADERS, agent }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          reject(new Error(`invalid json from ${apiUrl}`))
        }
      })
    })
    req.setTimeout(6000, () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

/**
 * 解析目标 IP 归属地；私有地址或全部平台失败返回 null。
 * @param {string} [ip]    目标 IP；为空/私有时查询服务出口 IP
 * @param {string} [proxy] 代理地址；存在时经代理连接 GEO 服务，返回代理出口 IP 归属地
 * @returns {Promise<{ip:string;countryName:string;countryCode:string;regionName:string;cityName:string;timeZone:string;isp:string}|null>}
 */
export async function lookupGeo(ip, proxy) {
  const target = isPrivateIp(ip) ? '' : ip ?? ''
  const agent = proxy ? buildAgent(proxy) : undefined
  if (proxy && !agent) return null
  for (const platform of platforms) {
    const apiUrl = target ? `${platform.url}/${encodeURIComponent(target)}` : platform.url
    try {
      const raw = await requestJson(apiUrl, agent)
      const n = platform.normalize(raw)
      if (!n.ip) continue
      return {
        ip: n.ip,
        countryName: n.countryName ?? '',
        countryCode: n.countryCode ?? '',
        regionName: n.regionName ?? '',
        cityName: n.cityName ?? '',
        timeZone: n.timeZone ?? '',
        isp: n.isp ?? ''
      }
    } catch {
      // 当前平台不可达，尝试下一平台
    }
  }
  return null
}
