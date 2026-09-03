/**
 * @file: 代理工具
 * @author: FreeRPA
 */
import { lookupGeo } from './geo.js'

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
    BR: 'pt-BR', PT: 'pt-PT',
    NL: 'nl-NL', SE: 'sv-SE', NO: 'nb-NO', DK: 'da-DK',
    FI: 'fi-FI', PL: 'pl-PL', TR: 'tr-TR', IN: 'hi-IN',
    SA: 'ar-SA', AE: 'ar-AE', IL: 'he-IL', TH: 'th-TH',
    VN: 'vi-VN', ID: 'id-ID'
  }

  return countryToLanguageMap[countryCode.trim().toUpperCase()] || 'en-US'
}

/**
 * 本地查询 IP 归属地（直连 GEO 服务，多平台容灾，不再桥接网站 /geo/query）
 * @param {string} [proxyUrl] 代理地址；存在时经代理查询其出口 IP 归属地
 * @returns {Promise<{ip,country,region,city,isp,timeZone,language,countryCode}|null>}
 */
export const queryGeoInfo = async (proxyUrl) => {
  const data = await lookupGeo('', proxyUrl)
  if (!data) return null
  const cc = (data.countryCode || '').toUpperCase()
  return {
    ip: data.ip || '',
    country: data.countryName || '',
    region: data.regionName || '',
    city: data.cityName || '',
    isp: data.isp || '',
    timeZone: data.timeZone || '',
    language: getLanguageByCountryCode(cc),
    countryCode: cc
  }
}
