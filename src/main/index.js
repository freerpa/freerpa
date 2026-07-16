import { createHttpServer } from './app/httpServer'
import { bootstrap } from './app/bootstrap'

// 启动 HTTP 服务（注册到 global）
global.httpServer = createHttpServer()

// 引导应用启动
bootstrap()
