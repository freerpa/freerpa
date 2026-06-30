import { H3, serve } from 'h3'
import { getCanUsePort } from './port'

/**
 * 创建内置 HTTP 服务（基于 H3 路由）
 */
export const createHttpServer = () => {
  const router = new Map()

  const app = new H3().all('**', async (req) => {
    const handler = router.get(`${req.url.pathname}:${req.method}`)
    if (!handler) {
      return {
        code: 404,
        msg: `${global.appName} HTTP Server:404 not found`,
        data: null
      }
    }
    const result = await handler(req)
    return { code: 200, msg: 'success', data: result }
  })

  app.get('/', async () => `${global.appName} HTTP Server`)

  const httpPort = getCanUsePort(9264)
  const server = serve(app, { port: httpPort })

  const createRouter = (method, path, handler) => {
    if (router.has(`${path}:${method}`)) {
      throw new Error(`路由地址 ${path} 已存在，请更换`)
    }
    router.set(`${path}:${method}`, handler)
  }

  const removeRouter = (method, path) => {
    router.delete(`${path}:${method}`)
  }

  return { createRouter, removeRouter, port: httpPort, server }
}
