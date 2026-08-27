import { RiDatabase2Line } from '@remixicon/vue'
/**
 * @file: 连接数据库节点
 * @author: dabao
 */
export default {
  type: 'dbConnect',
  name: '连接数据库',
  icon: RiDatabase2Line,
  description: '连接外部数据库，支持 MySQL、PostgreSQL、SQLite',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'dbType',
          name: '数据库类型',
          type: 'select',
          required: true,
          options: [
            { label: 'MySQL / MariaDB', value: 'mysql' },
            { label: 'PostgreSQL', value: 'postgres' },
            { label: 'SQLite', value: 'sqlite' }
          ],
          default: 'mysql',
          description: '要连接的数据库类型',
          onChange: (value, formData) => {
            // 切换类型时按默认端口回填（仅当端口未手动填写）
            const defaults = { mysql: 3306, postgres: 5432, sqlite: null }
            if (!formData.port && defaults[value]) {
              formData.port = defaults[value]
            }
          },
          quickConfig: true
        },
        {
          id: 'host',
          name: '主机地址',
          type: 'text',
          required: true,
          default: 'localhost',
          show: '${dbType} !== "sqlite"',
          description: '数据库主机地址，如 localhost',
          quickConfig: true
        },
        {
          id: 'port',
          name: '端口',
          type: 'number',
          show: '${dbType} !== "sqlite"',
          description: '数据库端口（MySQL 默认 3306，PostgreSQL 5432），留空使用默认端口',
          quickConfig: true
        },
        {
          id: 'database',
          name: '数据库名',
          type: 'text',
          required: true,
          show: '${dbType} !== "sqlite"',
          description: '要连接的数据库名称',
          quickConfig: true
        },
        {
          id: 'username',
          name: '用户名',
          type: 'text',
          default: 'root',
          show: '${dbType} !== "sqlite"',
          description: '数据库用户名',
          quickConfig: true
        },
        {
          id: 'password',
          name: '密码',
          type: 'text',
          show: '${dbType} !== "sqlite"',
          description: '数据库密码',
          quickConfig: true
        },
        {
          id: 'filePath',
          name: '数据库文件',
          type: 'path',
          pathType: 'file',
          required: true,
          show: '${dbType} === "sqlite"',
          description: 'SQLite 数据库文件路径',
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      id: 'connection',
      name: '数据库',
      type: 'dbConnection',
      description: '数据库连接引用，供执行SQL节点使用'
    }
  ]
}
