/**
 * @file: 代理地址智能格式化
 * @author: FreeRPA
 *
 * 把常见代理格式统一解析为 user:pass@host:port（无认证时为 host:port），
 * 供代理输入框失焦时自动格式化。
 *
 * 支持格式：
 * - 竖线分隔：ip|端口|用户名|密码|备注（备注忽略，如过期时间 26-10-13）
 * - 冒号分隔：ip:端口:用户名:密码[:备注]
 * - 冒号反序：用户名:密码:ip:端口
 * - 标准格式：user:pass@host:port / host:port
 * - 带协议头：http://、https://、socks5://、socks4://、socks://（协议头剥离返回 scheme）
 */

// IP 或域名（宽松：字母数字开头，可含 . -）
const isHost = (x) => /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(x)
// 端口：1-5 位纯数字
const isPort = (x) => /^\d{1,5}$/.test(x)

const buildAddress = (host, port, user, pass) => {
  const hp = [host, port].filter(Boolean).join(':')
  if (!hp) return ''
  if (!user) return hp
  return `${user}${pass ? ':' + pass : ''}@${hp}`
}

/**
 * 格式化代理地址
 * @param {string} input 原始输入
 * @returns {{address: string, scheme: string|null}}
 *          address 为 user:pass@host:port（或 host:port）；scheme 为识别到的协议头（无则为 null）
 */
export const normalizeProxy = (input) => {
  let s = String(input ?? '').trim()
  if (!s) return { address: s, scheme: null }

  // 1. 提取协议头（http/https/socks4/socks5/socks）
  let scheme = null
  const schemeMatch = s.match(/^(https?|socks4|socks5|socks):\/\//i)
  if (schemeMatch) {
    scheme = schemeMatch[1].toLowerCase()
    s = s.slice(schemeMatch[0].length).trim()
  }

  // 2. 已含 @：user[:pass]@host[:port]，已是标准格式
  if (s.includes('@')) {
    return { address: s, scheme }
  }

  // 3. 竖线分隔：ip|端口|用户名|密码|备注（第 5 段起为备注，忽略）
  if (s.includes('|')) {
    const parts = s.split('|').map((p) => p.trim())
    return { address: buildAddress(parts[0], parts[1], parts[2], parts[3]), scheme }
  }

  // 4. 冒号分隔
  const parts = s.split(':').map((p) => p.trim())
  if (parts.length === 2) {
    // host:port
    return { address: s, scheme }
  }
  if (parts.length === 3 && isHost(parts[0]) && isPort(parts[1])) {
    // host:端口:用户名（无密码）
    return { address: buildAddress(parts[0], parts[1], parts[2]), scheme }
  }
  if (parts.length >= 4) {
    // host:端口:用户名:密码[:备注]
    if (isHost(parts[0]) && isPort(parts[1])) {
      return { address: buildAddress(parts[0], parts[1], parts[2], parts[3]), scheme }
    }
    // 反序：用户名:密码:host:端口
    if (isHost(parts[2]) && isPort(parts[3])) {
      return { address: buildAddress(parts[2], parts[3], parts[0], parts[1]), scheme }
    }
  }

  // 5. 无法识别，原样返回
  return { address: s, scheme }
}
