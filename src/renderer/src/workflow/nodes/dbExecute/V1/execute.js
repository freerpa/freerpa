/**
 * @file: 执行SQL节点执行器
 * @description: 在连接数据库节点建立的连接上执行 SQL（主进程执行，worker 透传）。
 * 输入 connection 为连接引用（必传）；输出执行结果 { rows, affectedRows }。
 */
import { dbQuery } from '@dataModule'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  const connectionId = inputs?.connection
  if (!connectionId) {
    throw new Error('请先连接数据库并传入数据库连接')
  }
  const { sql } = config
  if (!sql || !String(sql).trim()) {
    throw new Error('SQL 语句不能为空')
  }

  const result = await dbQuery(connectionId, String(sql))
  complete({ result })
}

export default execute
