import { RiTerminalLine } from '@remixicon/vue'
/**
 * @file: 执行SQL节点
 * @author: dabao
 */
export default {
  type: 'dbExecute',
  name: '执行SQL',
  icon: RiTerminalLine,
  description: '在已连接的数据库上执行 SQL 语句',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        sql: {
          id: 'sql',
          name: 'SQL',
          type: 'code',
          language: 'sql',
          required: true,
          default: `/* 在这里编写 SQL 语句 */
SELECT * FROM table_name`,
          description: '要执行的 SQL 语句',
          quickConfig: true
        }
      }
    }
  },
  inputs: [
    {
      id: 'connection',
      name: '数据库连接',
      type: 'dbConnection',
      required: true,
      description: '来自连接数据库节点的连接引用'
    }
  ],
  outputs: [
    {
      id: 'result',
      name: '执行结果',
      type: 'any',
      description: 'SQL 执行结果对象 { rows, affectedRows }：rows 为查询行数组，affectedRows 为影响行数'
    }
  ]
}
