import { createHttpServer } from './app/httpServer'
import { cleanupOldSessions } from './app/sessionCleanup'
import { bootstrap } from './app/bootstrap'

// 启动 HTTP 服务（注册到 global）
global.httpServer = createHttpServer()

// 清理过期 Session 分区
cleanupOldSessions()

// 引导应用启动
bootstrap()
