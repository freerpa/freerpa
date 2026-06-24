
import { API_CONFIG } from '@/api/config';
// 获取IP信息
export const getIpInfo = async (ip = '', method = 'IP138') => {
    try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/ip?ip=${ip}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        const data = await res.json()
        return data
    } catch (error) {
        throw error
    }
}


const http = require('http');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
/**
 * 从标准代理地址中提取 IPv4 地址
 * @param {string} proxyUrl - 标准代理地址，支持以下格式：
 *                            - 基础格式: http://127.0.0.1:8080、https://192.168.1.1:8888、socks://223.5.5.5:720
 *                            - 带认证: http://user:pass@1.2.3.4:9999、socks5://admin:123456@10.0.0.1:8000
 *                            - 简写协议: socks5://8.8.8.8:720
 * @returns {object} 提取结果
 *                  - success: 布尔值，是否提取成功
 *                  - ip: 提取到的 IP 地址（成功时返回）
 *                  - error: 错误信息（失败时返回）
 */
export const extractIpFromProxy = (proxyUrl) => {
    // 第一步：输入验证
    if (typeof proxyUrl !== 'string' || proxyUrl.trim() === '') {
        return '';
    }

    // 第二步：IPv4 正则表达式（匹配 0.0.0.0 ~ 255.255.255.255 格式）
    // 正则说明：
    // - (?:\d{1,3}\.){3}\d{1,3}：匹配 xxx.xxx.xxx.xxx 格式的 IPv4
    // - 结合代理地址特征，先剔除协议、认证信息，再匹配 IP
    const ipv4Regex = /(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)/;

    // 第三步：提取 IP（忽略协议、认证信息，直接匹配 IP 段）
    const matchResult = proxyUrl.match(ipv4Regex);

    if (!matchResult) {
        return '';
    }

    const ip = matchResult[0];

    // 额外校验：确保提取的 IP 是合法的 IPv4（避免匹配到 999.999.999.999 这类无效值）
    const ipSegments = ip.split('.');
    const isLegalIpv4 = ipSegments.every(segment => {
        const num = parseInt(segment, 10);
        return !isNaN(num) && num >= 0 && num <= 255;
    });

    if (!isLegalIpv4) {
        return '';
    }

    // 提取成功
    return ip;
}


/**
 * 验证代理是否有效
 * @param {string} proxyUrl - 代理地址，格式示例：
 *                            - HTTP 代理: http://127.0.0.1:8080
 *                            - HTTPS 代理: https://127.0.0.1:8080
 *                            - SOCKS5 代理: socks://127.0.0.1:720
 * @param {object} [options] - 可选配置
 * @param {number} [options.timeout=5000] - 请求超时时间（毫秒）
 * @param {string} [options.testUrl='https://httpbin.org/ip'] - 测试代理的目标地址
 * @returns {Promise<{isValid: boolean, ip?: string, error?: string}>} 验证结果
 */
export async function validateProxy(proxyUrl, options = {}) {
    // 默认配置
    const {
        timeout = 5000,
        testUrl = 'https://httpbin.org/ip'
    } = options;

    try {
        // 解析测试地址的协议（http/https）
        const isHttpsTestUrl = testUrl.startsWith('https');
        const requestModule = isHttpsTestUrl ? https : http;

        // 根据代理类型创建对应的 Agent
        let agent;
        if (proxyUrl.startsWith('http')) {
            // HTTP/HTTPS 代理
            agent = new HttpsProxyAgent(proxyUrl);
        } else if (proxyUrl.startsWith('socks')) {
            // SOCKS 代理（支持 SOCKS4/SOCKS5）
            agent = new SocksProxyAgent(proxyUrl);
        } else {
            throw new Error('不支持的代理类型，仅支持 http/https/socks 协议');
        }

        // 构建请求配置
        const requestOptions = {
            agent,
            timeout,
            // 禁用重定向，避免额外耗时
            maxRedirects: 0
        };

        // 发送测试请求
        const result = await new Promise((resolve, reject) => {
            const req = requestModule.get(testUrl, requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            // 解析返回的 IP 信息（httpbin.org/ip 会返回 {"origin":"x.x.x.x"}）
                            const { origin } = JSON.parse(data);
                            resolve({ isValid: true, ip: origin });
                        } catch (e) {
                            reject(new Error('解析测试响应失败: ' + e.message));
                        }
                    } else {
                        reject(new Error(`代理返回异常状态码: ${res.statusCode}`));
                    }
                });
            });

            // 超时处理
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('请求超时'));
            });

            // 错误处理（连接失败、认证错误等）
            req.on('error', (err) => {
                reject(new Error(`代理连接失败: ${err.message}`));
            });
        });
        const ip = extractIpFromProxy(proxyUrl);
        const ipInfo = await getIpInfo(ip)
        if (ipInfo) {
            result.ipInfo = ipInfo
        }
        return result;
    } catch (error) {
        // 捕获所有异常，返回验证失败结果
        return {
            isValid: false,
            error: error.message
        };
    }
}


export const uuidTo10Decimal = (uuid) => {
    // 1. 验证并清洗UUID：移除所有-，检查是否为32位十六进制字符串
    const cleanUuid = uuid.replace(/-/g, '').toLowerCase();
    const uuidRegex = /^[0-9a-f]{32}$/;
    if (!uuidRegex.test(cleanUuid)) {
        throw new Error('请传入合法的UUID字符串（如：1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed）');
    }

    // 2. 将十六进制UUID转为BigInt（避免精度丢失）
    const uuidBigInt = BigInt(`0x${cleanUuid}`);

    // 3. 取模得到0~9999999999之间的整数（对应10位小数的有效部分）
    const max10Digit = BigInt(10 ** 10); // 10000000000
    const decimalPart = uuidBigInt % max10Digit;

    // 4. 转换为字符串并补零到10位，最终拼接成0.xxxxxxxxxx格式
    const decimalStr = decimalPart.toString().padStart(10, '0');
    const result = `0.${decimalStr}`;

    return result;
}


/**
 * 根据国家编码获取对应的浏览器语言代码
 * @param {string} countryCode - 国家编码（如 CN、US、JP，大小写均可）
 * @returns {string} 浏览器标准语言代码（如 zh-CN、en-US），无匹配时返回 en-US
 */
export const getLanguageByCountryCode = (countryCode) => {
  // 1. 参数校验：确保输入是字符串且非空
  if (typeof countryCode !== 'string' || countryCode.trim() === '') {
    console.warn('国家编码必须是非空字符串');
    return 'en-US'; // 默认返回英语（美国）
  }

  // 2. 标准化国家编码：转为大写（兼容小写输入，如 cn → CN）
  const normalizedCode = countryCode.trim().toUpperCase();

  // 3. 国家编码 → 浏览器语言代码 映射表（覆盖主流国家，可按需扩展）
  const countryToLanguageMap = {
    // 中文区
    CN: 'zh-CN',    // 中国 → 简体中文
    TW: 'zh-TW',    // 中国台湾 → 繁体中文
    HK: 'zh-HK',    // 中国香港 → 繁体中文（香港）
    // 英语区
    US: 'en-US',    // 美国 → 美式英语
    GB: 'en-GB',    // 英国 → 英式英语
    CA: 'en-CA',    // 加拿大 → 英语（加拿大）
    AU: 'en-AU',    // 澳大利亚 → 英语（澳大利亚）
    // 其他主流语言
    JP: 'ja-JP',    // 日本 → 日语
    KR: 'ko-KR',    // 韩国 → 韩语
    DE: 'de-DE',    // 德国 → 德语
    FR: 'fr-FR',    // 法国 → 法语
    ES: 'es-ES',    // 西班牙 → 西班牙语（西班牙）
    MX: 'es-MX',    // 墨西哥 → 西班牙语（墨西哥）
    IT: 'it-IT',    // 意大利 → 意大利语
    RU: 'ru-RU',    // 俄罗斯 → 俄语
    BR: 'pt-BR',    // 巴西 → 葡萄牙语（巴西）
    PT: 'pt-PT'     // 葡萄牙 → 葡萄牙语（葡萄牙）
  };

  // 4. 查找映射：存在则返回对应语言，否则返回默认值 en-US
  return countryToLanguageMap[normalizedCode] || 'en-US';
}

