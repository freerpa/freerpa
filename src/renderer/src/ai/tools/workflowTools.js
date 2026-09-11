/**
 * @file: 工作流相关 AI 工具定义（与执行器分离，控制单文件规模）
 * 设计原则：
 * - 模型只表达意图（创建/连接/更新/删除），不接触端口 handle、nodeId 生成等底层细节
 * - config 采用宽松 object（additionalProperties: true），由执行器按节点字段定义容错合并，
 *   模型填错字段不报错（OpenAI 兼容 API 对复杂嵌套 schema 遵循差，是此前 400 失败主因）
 * - 删除节点属于危险操作：执行器内弹确认框，用户确认后才执行
 */
import { defineTool } from './defineTool.js'

export const createWorkflowTools = () => [
  defineTool('listNodeTypes', '列出当前可用的所有节点类型（type 与名称），用于确定创建节点时 type 取值。', {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '按名称/类型模糊搜索，可选', default: '' }
    },
    additionalProperties: false
  }),
  defineTool(
    'getNodeConfig',
    '查询某个节点类型的配置说明。默认返回精简概览（类型/必填输入/输出/关键字段），快速判断节点用途；填写复杂配置时传 detail=true 获取完整字段说明（默认值/枚举/嵌套字段）。',
    {
      type: 'object',
      properties: {
        type: { type: 'string', description: '节点类型（如 workflowStart、networkHttpRequest、workflowIf、plu_ 插件节点）' },
        detail: { type: 'boolean', description: '是否返回完整字段说明，默认 false（精简概览）', default: false }
      },
      required: ['type'],
      additionalProperties: false
    }
  ),
  defineTool(
    'addNode',
    '在工作流画布中创建一个节点。connectTo 指定前驱节点（名称或ID均可，推荐名称），创建后自动按端口类型规则连线；并行创建多个串行节点时，每个新节点的 connectTo 直接写前驱节点名称即可自动成链；config 为节点配置参数，字段按 getNodeConfig 的说明填写，不传则用默认值。',
    {
      type: 'object',
      properties: {
        type: { type: 'string', description: '节点类型，用 listNodeTypes 查询' },
        name: { type: 'string', description: '节点名称' },
        connectTo: { type: 'string', description: '要连接的前驱节点（名称或ID均可，推荐用节点名称，如「开始流程」），省略则新节点会处于未连接状态', default: '' },
        handleId: { type: 'string', enum: ['next', 'next-false'], description: '分支端口：next（默认，流程主线；对判断节点即条件满足的“是”分支）/ next-false（仅判断节点可用：条件不满足的“否”分支）', default: 'next' },
        config: {
          type: 'object',
          description: '节点配置参数（字段与取值见 getNodeConfig 的 schema），不传则用默认值',
          additionalProperties: true
        }
      },
      required: ['type', 'name'],
      additionalProperties: false
    }
  ),
  defineTool('connect', '连接两个已有节点（按节点端口类型规则自动连线，无需指定端口）。', {
    type: 'object',
    properties: {
      source: { type: 'string', description: '源节点（输出方）：名称或ID均可' },
      target: { type: 'string', description: '目标节点（输入方）：名称或ID均可' }
    },
    required: ['source', 'target'],
    additionalProperties: false
  }),
  defineTool(
    'updateNode',
    '更新已有节点的配置（config）或名称（name）。',
    {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: '节点ID' },
        name: { type: 'string', description: '新名称，可选', default: '' },
        config: {
          type: 'object',
          description: '要更新的配置字段（只更新传入的字段），字段说明见 getNodeConfig',
          additionalProperties: true
        }
      },
      required: ['nodeId'],
      additionalProperties: false
    }
  ),
  defineTool('deleteNode', '删除工作流中的节点（危险操作：会弹确认框，用户确认后才执行；被取消则返回 cancelled）。', {
    type: 'object',
    properties: { nodeId: { type: 'string', description: '节点ID' } },
    required: ['nodeId'],
    additionalProperties: false
  }),
  defineTool('deleteEdge', '删除当前工作流中的指定连线。', {
    type: 'object',
    properties: { edgeId: { type: 'string', description: '连线ID' } },
    required: ['edgeId'],
    additionalProperties: false
  }),
  defineTool('getWorkflows', '查询本地保存的工作流列表（用于引用已有工作流；返回内容中节点 config 的密钥类字段已脱敏为 ****）。', {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '按名称模糊搜索', default: '' },
      page: { type: 'number', description: '页码，默认1', default: 1 },
      pageSize: { type: 'number', description: '每页条数，默认10', default: 10 }
    },
    additionalProperties: false
  }),
  defineTool('getWorkflow', '按 ID 查询单个工作流的详情（节点与连线；config 中密钥类字段已脱敏为 ****，如需重新填值请用 updateNode）。', {
    type: 'object',
    properties: { id: { type: 'string', description: '工作流ID' } },
    required: ['id'],
    additionalProperties: false
  }),
  defineTool(
    'finish',
    '本会话的最终工具：当你认为已达成用户需求的目标时调用它标记完成（调用后本轮对话结束）。',
    undefined,
    { strict: false }
  )
]
