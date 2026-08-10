/**
 * @file: 数据表相关 AI 工具（data 模块）
 * 执行器调用 window.electronAPI.data.*（即主进程 data:* IPC）
 */
const data = () => window.electronAPI.data

// 工具结果注入 LLM 上下文的大小上限（head/tail 截断，见 guard.js）
import { limitText, assertArgs } from './guard.js'

const toText = (res) => limitText(res)

export const createDataTableTools = () => [
  {
    type: 'function',
    function: {
      name: 'listTables',
      description: '列出所有数据表（数据表即「数据管理」中的数据模型）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '按表名搜索', default: '' },
          page: { type: 'number', description: '页码，默认1', default: 1 },
          pageSize: { type: 'number', description: '每页条数，默认20', default: 20 }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTable',
      description: '获取单个数据表的详情（字段结构）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '数据表ID' } },
        required: ['id'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createTable',
      description:
        '创建数据表（数据管理中的数据模型，搭建工作流需要配套数据存储时用）。fields 为字段定义数组，至少 1 个字段：每个字段 name 为英文标识（如 name/price，规则 /^[a-zA-Z][a-zA-Z0-9_]*$/，不能是 id/color/created_at），description 为字段中文名（表格表头，必填），type 支持 string/number/date。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '数据表名称' },
          description: { type: 'string', description: '数据表描述', default: '' },
          category_id: { type: 'string', description: '所属分类ID（可选，默认不分类）', default: '' },
          fields: {
            type: 'array',
            description: '字段定义（至少 1 个）',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '字段英文标识（如 goods_name，拼音或英文）' },
                description: { type: 'string', description: '字段中文名（表格表头，必填）' },
                type: { type: 'string', enum: ['string', 'number', 'date'], description: '字段类型' },
                required: { type: 'boolean', description: '是否必填（可选，默认 false）' },
                unique: { type: 'boolean', description: '是否唯一（可选，默认 false）' }
              },
              required: ['name', 'description', 'type'],
              additionalProperties: false
            }
          }
        },
        required: ['name'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteTable',
      description: '删除数据表（数据管理中的数据模型，含其全部数据，危险操作）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '数据表ID' } },
        required: ['id'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'queryData',
      description: '查询数据表中的记录。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          modelId: { type: 'string', description: '数据表ID' },
          page: { type: 'number', description: '页码，默认1', default: 1 },
          pageSize: { type: 'number', description: '每页条数，默认10', default: 10 },
          filters: {
            type: 'array',
            description: '过滤条件',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', description: '字段名' },
                operator: {
                  type: 'string',
                  enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'in'],
                  description: '比较操作符'
                },
                value: { description: '比较值' }
              },
              required: ['field', 'operator', 'value'],
              additionalProperties: false
            }
          }
        },
        required: ['modelId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createData',
      description: '向数据表新增一条记录。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          modelId: { type: 'string', description: '数据表ID' },
          data: {
            type: 'object',
            description: '要写入的字段值（字段名: 值）',
            additionalProperties: true
          }
        },
        required: ['modelId', 'data'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'updateData',
      description: '批量更新数据表中的记录（按 id 数组）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          modelId: { type: 'string', description: '数据表ID' },
          ids: {
            type: 'array',
            description: '要更新的记录 id 列表',
            items: { type: ['number', 'string'] }
          },
          data: {
            type: 'object',
            description: '要更新的字段值（字段名: 值）',
            additionalProperties: true
          }
        },
        required: ['modelId', 'ids', 'data'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteData',
      description: '批量删除数据表中的记录（按 id 数组）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          modelId: { type: 'string', description: '数据表ID' },
          ids: {
            type: 'array',
            description: '要删除的记录 id 列表',
            items: { type: ['number', 'string'] }
          }
        },
        required: ['modelId', 'ids'],
        additionalProperties: false
      }
    }
  }
]

export const createDataTableExecutors = () => ({
  listTables: async ({ keyword = '', page = 1, pageSize = 20 } = {}) =>
    toText(await data().getModels({ keyword, page, pageSize })),
  getTable: async (args) => {
    assertArgs(args, ['id'])
    return toText(await data().getModel(args.id))
  },
  queryData: async (args) => {
    const { modelId, page = 1, pageSize = 10, filters = [] } = args || {}
    assertArgs(args, ['modelId'])
    // 工具 schema 用数组 [{field, operator, value}]，主进程 getModelData 要求对象 { field: {operator, value} }，在此转换
    const filterObj = {}
    ;(filters || []).forEach((f) => {
      if (f?.field && f?.operator) filterObj[f.field] = { operator: f.operator, value: f.value }
    })
    const res = await data().getModelData({ modelId, page, pageSize, filters: filterObj })
    return toText(res)
  },
  createTable: async (args) => {
    const { name, description = '', category_id = '', fields = [] } = args || {}
    assertArgs(args, ['name'])
    if (!Array.isArray(fields)) throw new Error('fields 必须为数组')
    // fields 至少 1 个且字段 description（中文名）必填——与真实表单一致，空表/缺中文名会生成非法 SQL
    if (fields.length === 0) throw new Error('fields 至少需要 1 个字段（description 为字段中文名必填）')
    for (const f of fields) {
      if (!f?.name || !f?.description) throw new Error('每个字段必须有 name（英文标识）与 description（中文名）')
    }
    return toText(await data().createModel({ name, description, category_id, fields }))
  },
  deleteTable: async (args) => {
    assertArgs(args, ['id'])
    return toText(await data().deleteModel(args.id))
  },
  createData: async (args) => {
    const payload = args?.data
    assertArgs(args, ['modelId'])
    if (!payload || typeof payload !== 'object') throw new Error('data 必须为对象')
    return toText(await data().createModelData({ modelId: args.modelId, data: payload }))
  },
  updateData: async (args) => {
    const { modelId, ids, data: payload } = args || {}
    assertArgs(args, ['modelId'])
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids is required')
    if (!payload || typeof payload !== 'object') throw new Error('data 必须为对象')
    return toText(await data().updateModelData({ modelId, ids, data: payload }))
  },
  deleteData: async (args) => {
    const { modelId, ids } = args || {}
    assertArgs(args, ['modelId'])
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids is required')
    return toText(await data().deleteModelData({ modelId, ids }))
  }
})
