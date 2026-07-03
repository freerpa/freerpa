/**
 * @file: 代理工具
 * @author: FreeRPA
 */

/**
 * 根据国家编码获取对应的浏览器语言代码
 */
export const getLanguageByCountryCode = (countryCode) => {
  if (typeof countryCode !== 'string' || countryCode.trim() === '') {
    return 'en-US'
  }

  const countryToLanguageMap = {
    CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-HK',
    US: 'en-US', GB: 'en-GB', CA: 'en-CA', AU: 'en-AU',
    JP: 'ja-JP', KR: 'ko-KR', DE: 'de-DE', FR: 'fr-FR',
    ES: 'es-ES', MX: 'es-MX', IT: 'it-IT', RU: 'ru-RU',
    BR: 'pt-BR', PT: 'pt-PT'
  }

  return countryToLanguageMap[countryCode.trim().toUpperCase()] || 'en-US'
}

/**
 * 查询代理 IP 的地理信息（时区、语言等）
 */
export const queryGeoInfo = async (proxyUrl, baseUrl) => {
  const url = proxyUrl
    ? `${baseUrl}/geo/query?proxy=${encodeURIComponent(proxyUrl)}`
    : `${baseUrl}/geo/query`
  const res = await fetch(url)
  const data = await res.json()
  if (data.code === 200 && data.data) {
    const d = data.data
    const cc = (d.countryCode || '').toUpperCase()
    return {
      ip: d.ipAddress || d.ip || d.query || '',
      country: d.countryName || '',
      region: d.regionName || '',
      city: d.cityName || '',
      isp: d.isp || '',
      timeZone: d.timeZone || '',
      language: getLanguageByCountryCode(cc),
      countryCode: cc
    }
  }
  return null
}
