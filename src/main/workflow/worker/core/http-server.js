/**
 * @file: 工作流 HTTP 服务（worker 内共享单例）
 *
 * 挂载到 engine.global.httpServer（跨节点共享）：多个 networkHttpServer 节点注册不同路由，
 * 共享同一 server 与端口。node:http 经 import map 的 http→node:http 解析。
 *
 * 权限注意：监听 127.0.0.1 需要 worker net 权限包含 localhost/127.0.0.1
 * （权限默认 allow-all 时不受限；allow-list 模式需显式加入）。
 */
import http from 'node:http'

/** 获取全局 HTTP server（懒创建，按 engine.global.networkServerPort 监听 127.0.0.1，未配置回退随机端口；首次创建后缓存于 global） */
export const getHttpServer = async (global) => {
  if (global.httpServer) return global.httpServer

  const routers = new Map() // `${method}:${route}` → handler

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    const handler = routers.get(`${req.method}:${pathname}`)
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not Found' }))
      return
    }
    try {
      const result = (await handler(req)) || {}
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e?.message || String(e) }))
    }
  })

  // 默认端口：engine.global.networkServerPort（主进程经 init 注入，设置中心可配；0 防御性回退随机端口）
  const listenPort = global?.networkServerPort || 0
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    // 指定端口被占用时 listen 抛 EADDRINUSE（提示用户更换默认端口）；0 时由系统分配随机端口
    server.listen(listenPort, '127.0.0.1', resolve)
  })

  const port = server.address().port
  global.httpServer = {
    port,
    createRouter: (method, route, handler) => routers.set(`${method}:${route}`, handler),
    removeRouter: (method, route) => routers.delete(`${method}:${route}`),
    close: () => new Promise((resolve) => server.close(resolve))
  }
  return global.httpServer
}
