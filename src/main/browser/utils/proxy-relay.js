/**
 * @file: 本地无认证中转代理
 * @author: FreeRPA
 *
 * 解决 Chromium --proxy-server 不支持内嵌认证凭据（会弹原生认证框 / 无头直接失败）的问题：
 * 在本地 127.0.0.1 随机端口起一个无认证 HTTP 代理，Chromium 只连它；
 * 由它把请求转发给真实上游代理（HTTP/HTTPS 注入 Proxy-Authorization，SOCKS5 走握手认证）。
 * 上游凭据只存在于本地中转与上游之间，浏览器侧永远无认证、不弹框。
 *
 * 注意：所有透传流都必须监听 error —— 浏览器/上游随时可能断开（ECONNRESET），
 * 未监听的流错误会冒泡成主进程 uncaughtException（Electron 弹「A JavaScript error occurred」）。
 */

import http from 'http'
import https from 'https'
import { SocksClient } from 'socks'

// 逐跳（hop-by-hop）头：转发时剔除，避免污染上游连接
const HOP_BY_HOP = new Set([
  'connection', 'proxy-connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'
])

const filterHeaders = (headers = {}) => {
  const out = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) out[key] = value
  }
  return out
}

/**
 * 双向透传的错误处理：任一端出错（对端断开/重置）时销毁两端。
 * 代理场景下对端随时可能断开，错误一律吞掉，绝不让其冒泡成 uncaughtException。
 */
const relayPair = (a, b) => {
  const die = (x) => { try { x.destroy() } catch (_) {} }
  const onErr = () => { die(a); die(b) }
  a.on('error', onErr)
  b.on('error', onErr)
}

/**
 * 解析上游代理 URL
 * @returns {{scheme:string,host:string,port:number,userId:string,password:string,auth:string}}
 */
const parseUpstream = (proxyUrl) => {
  const url = new URL(proxyUrl)
  const scheme = url.protocol.replace(/:$/, '').toLowerCase()
  const host = url.hostname
  const port = Number(url.port) || (scheme.startsWith('socks') ? 1080 : 80)
  const userId = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password || '')
  const auth = userId
    ? 'Basic ' + Buffer.from(`${userId}:${password}`).toString('base64')
    : ''
  return { scheme, host, port, userId, password, auth }
}

/**
 * 解析 Chromium 发来的 absolute-form 请求行（如 http://example.com/path）
 */
const parseAbsoluteUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl)
    return {
      host: url.hostname,
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search
    }
  } catch {
    return null
  }
}

/**
 * 目标 Host 头（默认端口省略端口号；代理以此为准，忽略客户端 Host）
 */
const targetHost = (target) => {
  const isDefaultPort = target.port === 80 || target.port === 443
  return isDefaultPort ? target.host : `${target.host}:${target.port}`
}

/**
 * SOCKS5 上游：建立直达目标的隧道 socket
 */
const socksConnect = (up, host, port) =>
  SocksClient.createConnection({
    command: 'connect',
    proxy: {
      host: up.host,
      port: up.port,
      type: 5,
      ...(up.userId ? { userId: up.userId, password: up.password } : {})
    },
    destination: { host, port }
  }).then((info) => info.socket)

/**
 * 普通 HTTP 请求（Chromium 对 http:// 目标发送 absolute-form）
 */
const handleRequest = (up) => (req, res) => {
  const target = parseAbsoluteUrl(req.url)
  if (!target) {
    res.writeHead(400)
    res.end('Bad Request')
    return
  }
  // 客户端侧流先挂上错误监听（对端随时断开）
  relayPair(req, res)

  // SOCKS5 上游：先建直达目标的隧道，再以 origin-form 转发请求
  if (up.scheme.startsWith('socks')) {
    socksConnect(up, target.host, target.port)
      .then((socket) => {
        const head = [`${req.method} ${target.path} HTTP/1.1`]
        const headers = { ...filterHeaders(req.headers), host: targetHost(target) }
        for (const [key, value] of Object.entries(headers)) {
          head.push(`${key}: ${value}`)
        }
        socket.write(head.join('\r\n') + '\r\n\r\n')
        req.pipe(socket)
        socket.pipe(res)
        relayPair(socket, res)
        relayPair(req, socket)
      })
      .catch((e) => {
        res.writeHead(502)
        res.end(String(e?.message || e))
      })
    return
  }

  // HTTP/HTTPS 上游：absolute-form 原样转发，注入 Proxy-Authorization
  const Mod = up.scheme === 'https' ? https : http
  const proxyReq = Mod.request({
    host: up.host,
    port: up.port,
    method: req.method,
    path: req.url,
    headers: {
      ...filterHeaders(req.headers),
      host: targetHost(target),
      ...(up.auth ? { 'Proxy-Authorization': up.auth } : {})
    },
    agent: false
  })
  proxyReq.on('response', (upRes) => {
    // 上游 407 绝不透传给 Chromium（否则会弹原生认证框）：转为 502 + 主进程日志
    if (upRes.statusCode === 407) {
      console.error(`[proxy-relay] 上游代理认证失败(407): ${up.scheme}://${up.host}:${up.port}，请检查代理账号密码`)
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('上游代理认证失败(407)，请检查代理账号密码')
      return
    }
    res.writeHead(upRes.statusCode, upRes.headers)
    upRes.pipe(res)
    relayPair(upRes, res)
  })
  proxyReq.on('error', () => {
    if (!res.headersSent) res.writeHead(502)
    res.end()
  })
  req.pipe(proxyReq)
  relayPair(req, proxyReq)
}

/**
 * CONNECT 隧道（Chromium 对 https:// 目标 / 显式隧道发送）
 */
const handleConnect = (up) => (req, clientSocket, head) => {
  const [host, port] = req.url.split(':')
  const targetPort = Number(port) || 443

  // SOCKS5 上游：握手认证后直达目标
  if (up.scheme.startsWith('socks')) {
    socksConnect(up, host, targetPort)
      .then((socket) => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head?.length) socket.write(head)
        socket.pipe(clientSocket)
        clientSocket.pipe(socket)
        relayPair(clientSocket, socket)
      })
      .catch(() => {
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
        clientSocket.end()
      })
    return
  }

  // HTTP/HTTPS 上游：向代理发 CONNECT，注入认证，成功后透传
  const Mod = up.scheme === 'https' ? https : http
  const connectReq = Mod.request({
    host: up.host,
    port: up.port,
    method: 'CONNECT',
    path: `${host}:${targetPort}`,
    headers: up.auth ? { 'Proxy-Authorization': up.auth } : {},
    agent: false
  })
  connectReq.on('connect', (_, upSocket) => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head?.length) upSocket.write(head)
    upSocket.pipe(clientSocket)
    clientSocket.pipe(upSocket)
    relayPair(clientSocket, upSocket)
  })
  connectReq.on('response', (upRes) => {
    // 上游 407/4xx 不透传给 Chromium（避免弹原生认证框）：一律 502 + 主进程日志
    if (upRes.statusCode === 407) {
      console.error(`[proxy-relay] 上游代理 CONNECT 认证失败(407): ${up.scheme}://${up.host}:${up.port}，请检查代理账号密码`)
    }
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    clientSocket.end()
  })
  connectReq.on('error', () => {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    clientSocket.end()
  })
  connectReq.end()
}

/**
 * 创建本地无认证中转代理
 * @param {string} upstreamProxyUrl 上游代理地址（可含 user:pass，支持 http/https/socks5/socks5h）
 * @returns {Promise<{port:number, close:()=>Promise<void>}>}
 */
export const createProxyRelay = (upstreamProxyUrl) =>
  new Promise((resolve, reject) => {
    let up
    try {
      up = parseUpstream(upstreamProxyUrl)
    } catch (e) {
      reject(new Error(`无效的代理地址: ${upstreamProxyUrl}`))
      return
    }
    if (!up.host) {
      reject(new Error(`无效的代理地址: ${upstreamProxyUrl}`))
      return
    }

    const server = http.createServer()
    server.on('request', handleRequest(up))
    server.on('connect', handleConnect(up))
    server.on('error', reject)
    // HTTP 解析层 socket 错误兜底（半连接/畸形请求），防止冒泡
    server.on('clientError', (err, socket) => socket.destroy())
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        close: () =>
          new Promise((r) => {
            server.closeAllConnections?.()
            server.close(() => r())
          })
      })
    })
  })
