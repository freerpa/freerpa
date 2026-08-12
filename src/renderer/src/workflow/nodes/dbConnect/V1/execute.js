/**
 * @file: 连接数据库节点执行器
 * @description: 经主进程 RPC 建立外部数据库连接（MySQL/PostgreSQL/SQL Server/SQLite）。
 * 连接由主进程 knex 管理并按工作流归属，终态自动关闭；worker 仅透传配置。
 */
import { dbConnect } from '@dataModule'

const execute = async (node, context) => {
  const { config } = node
  const { complete } = context

  const { dbType, host, port, database, username, password, filePath } = config
  const result = await dbConnect({
    dbType,
    host,
    port,
    database,
    username,
    password,
    filePath
  })

  complete({
    connection: result.connectionId
  })
}

export default execute
