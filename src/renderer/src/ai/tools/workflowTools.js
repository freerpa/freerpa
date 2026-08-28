/**
 * @file: 工作流相关 AI 工具定义（与执行器分离，控制单文件规模）
 * 设计原则：
 * - 模型只表达意图（创建/连接/更新/删除），不接触端口 handle、nodeId 生成等底层细节
 * - config 采用宽松 object（additionalProperties: true），由执行器按节点字段定义容错合并，
 *   模型填错字段不报错（OpenAI 兼容 API 对复杂嵌套 schema 遵循差，是此前 400 失败主因）
 * - 删除节点属于危险操作：执行器内弹确认框，用户确认后才执行
 */
export const createWorkflowTools = () => [
  {
    type: 'function',
    function: {
      name: 'listNodeTypes',
      description: '列出当前可用的所有节点类型（type 与名称），用于确定创建节点时 type 取值。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '按名称/类型模糊搜索，可选', default: '' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getNodeConfig',
      description:
        '查询某个节点类型的配置说明。默认返回精简概览（类型/必填输入/输出/关键字段），快速判断节点用途；填写复杂配置时传 detail=true 获取完整字段说明（默认值/枚举/嵌套字段）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: '节点类型（如 workflowStart、httpRequest、workflowIf、plu_ 插件节点）' },
          detail: { type: 'boolean', description: '是否返回完整字段说明，默认 false（精简概览）', default: false }
        },
        required: ['type'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'addNode',
      description: '在工作流画布中创建一个节点。connectTo 可指定前驱节点ID（可选），创建后自动按端口类型规则连线；config 为节点配置参数，字段按 getNodeConfig 的说明填写，不传则用默认值。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: '节点类型，用 listNodeTypes 查询' },
          name: { type: 'string', description: '节点名称' },
          connectTo: { type: 'string', description: '要连接的前驱节点ID（可选）', default: '' },
          handleId: { type: 'string', enum: ['next', 'next-false'], description: '主流程分支（默认 next）', default: 'next' },
          config: {
            type: 'object',
            description: '节点配置参数（字段与取值见 getNodeConfig 的 schema），不传则用默认值',
            additionalProperties: true
          }
        },
        required: ['type', 'name'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'connect',
      description: '连接两个已有节点（按节点端口类型规则自动连线，无需指定端口）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: '源节点ID（输出方）' },
          target: { type: 'string', description: '目标节点ID（输入方）' }
        },
        required: ['source', 'target'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'updateNode',
      description: '更新已有节点的配置（config）或名称（name）。',
      strict: true,
      parameters: {
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
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteNode',
      description: '删除工作流中的节点（危险操作：会弹确认框，用户确认后才执行；被取消则返回 cancelled）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: { nodeId: { type: 'string', description: '节点ID' } },
        required: ['nodeId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteEdge',
      description: '删除当前工作流中的指定连线。',
      strict: true,
      parameters: {
        type: 'object',
        properties: { edgeId: { type: 'string', description: '连线ID' } },
        required: ['edgeId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getWorkflows',
      description: '查询本地保存的工作流列表（用于引用已有工作流）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '按名称模糊搜索', default: '' },
          page: { type: 'number', description: '页码，默认1', default: 1 },
          pageSize: { type: 'number', description: '每页条数，默认10', default: 10 }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getWorkflow',
      description: '按 ID 查询单个工作流的详情（节点与连线）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '工作流ID' } },
        required: ['id'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description:
        '本会话的最终工具：当你认为已达成用户需求的目标时调用它标记完成（调用后本轮对话结束）。'
    }
  }
]
