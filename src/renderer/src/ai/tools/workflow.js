/**
 * @file: 工作流相关 AI 工具（极小化意图工具面）
 * 设计原则：
 * - 模型只表达意图（创建/连接/更新/删除），不接触端口 handle、nodeId 生成等底层细节
 * - config 采用宽松 object（additionalProperties: true），由执行器按节点字段定义容错合并，
 *   模型填错字段不报错（OpenAI 兼容 API 对复杂嵌套 schema 遵循差，是此前 400 失败主因）
 * - 删除节点属于危险操作：执行器内弹确认框，用户确认后才执行
 * 执行器依赖画布上下文（vueFlowRef/flowStore），由 workflow/index.vue 注入。
 */
import nodes from '@nodes-path'
import { nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { autoLayout, autoConnect, getInitNodeData, ConnectionRules, isParamRefer, makeParamReferValue } from '@/workflow/utils'
import { useFlowStore } from '@/workflow/store'
import { buildNodeMeta } from './schema.js'
import { limitText, maskSensitive } from './guard.js'
import { quickValidateWorkflow } from '@/workflow/engine/validate'

/** 扁平化节点 config 字段定义：{ [fieldId]: { type, default, options } }（供容错合并） */
const flattenConfigFields = (configGroups = {}) => {
  const fields = {}
  Object.keys(configGroups).forEach((groupKey) => {
    const group = configGroups[groupKey]
    Object.keys(group?.fields || {}).forEach((fieldId) => {
      fields[fieldId] = group.fields[fieldId]
    })
  })
  return fields
}

/** 按字段类型容错转换值（模型可能传任意类型，统一收敛，不抛错） */
const coerceValue = (value, field) => {
  if (value === undefined || value === null) return undefined

  // 优先：完整参数引用穿透（任何类型都先于类型转换判断）——
  // 已是标准格式 {{路径}}--!@#$%freerpa-refer%$#@!--"旧值" 原样保留；
  // 纯 {{路径}} 规范化为完整引用（补 separator + 空旧值），
  // 避免 object/array 被 JSON.parse 吞掉、number/switch 被类型转换破坏
  if (typeof value === 'string') {
    if (isParamRefer(value)) return value
    if (/^{{([^{}]+)\.([^{}]+)}}$/.test(value)) {
      return makeParamReferValue('', value)
    }
  }

  const type = field?.type
  if (type === 'switch') return Boolean(value)
  if (type === 'number') {
    const n = Number(value)
    return Number.isNaN(n) ? undefined : n
  }
  if (type === 'array') {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      // 参数引用（{{路径}} 或 {{路径}}--!@#$%freerpa-refer%$#@!--"旧值"）：保持字符串让引用穿透——
      // 若走 JSON.parse 失败后包成 [value]，渲染层 Array 组件会拿到「数组包字符串」，
      // 子字段赋值报「Cannot create property 'rowIndex' on string」
      if (value.includes('{{') && value.includes('}}')) return value
      try {
        return JSON.parse(value)
      } catch {
        return [value]
      }
    }
    return [value]
  }
  if (type === 'object') {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    }
    return {}
  }
  if (type === 'input' || type === 'textarea' || type === 'code' || type === 'select' || type === 'radio' || !type) {
    return String(value)
  }
  return value
}

/** 容错合并 config：只取节点字段定义中存在的字段，按类型转换，忽略未知字段 */
const mergeConfig = (targetConfig, input, fields) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return targetConfig
  Object.keys(input).forEach((key) => {
    const field = fields[key]
    if (!field) return // 未知字段：忽略（模型填错不报错）
    const value = coerceValue(input[key], field)
    if (value !== undefined) targetConfig[key] = value
  })
  return targetConfig
}

/** 工作流数据脱敏：graph（JSON 字符串或对象）中 nodes 的 data.config 敏感字段打码（脱敏实现见 guard.js） */
const maskWorkflow = (wf) => {
  if (!wf) return wf
  const copy = { ...wf }
  let graph = copy.graph
  if (typeof graph === 'string') {
    try {
      graph = JSON.parse(graph)
    } catch {
      return copy
    }
  }
  if (graph && Array.isArray(graph.nodes)) {
    graph = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n?.data?.config ? { ...n, data: { ...n.data, config: maskSensitive(n.data.config) } } : n
      )
    }
    copy.graph = typeof wf.graph === 'string' ? JSON.stringify(graph) : graph
  }
  return copy
}

// ═══════════════════════ 工具定义 ═══════════════════════

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

// ═══════════════════════ 执行器 ═══════════════════════

export const createWorkflowExecutors = ({ workflowId }) => {
  // 从 Pinia store 响应式取 Vue Flow 实例：storeToRefs 解构的 ref 在每次调用时解包，
  // 不受「AI 面板比画布先挂载」的时序影响（此前通过 props 传组件 ref 的值快照，
  // 画布未就绪时快照为 null，执行器读 xxx.value 报「Cannot read properties of null (reading 'value')」）
  const flowStore = useFlowStore(workflowId)
  const { vueFlowRef } = storeToRefs(flowStore)
  const { createConnection, validateConnection } = new ConnectionRules(workflowId)
  const executors = {}

  // AI 改动后附加工作流可执行性检测（同步快速检测，低开销）：
  // 检测失败时以 warning 返回给模型，让模型感知问题并自我修正（与系统提示「warning 请修正后重试」一致）
  const attachValidation = (result) => {
    const { ok, errors } = quickValidateWorkflow(flowStore)
    if (!ok) {
      result.warning = `工作流当前无法正常执行：${errors.map((e) => e.message).join('；')}`
    }
    return result
  }

  // 自愈：清理画布中两端节点不存在的损坏连线（历史数据遗留，
  // 会让 autoLayout/连线校验读 null 崩溃，表现为"添加任何节点都报错"）
  try {
    const vf = vueFlowRef.value
    if (vf) {
      const nodeIds = new Set(vf.getNodes.map((n) => n.id))
      const brokenEdges = vf.getEdges.filter(
        (e) => !nodeIds.has(e.source) || !nodeIds.has(e.target)
      )
      if (brokenEdges.length > 0) {
        vf.removeEdges(brokenEdges.map((e) => e.id))
      }
    }
  } catch (error) {
    console.error('清理损坏连线失败:', error)
  }

  /** 取节点 config 扁平字段定义（用于容错合并） */
  const nodeFields = (type) => flattenConfigFields(nodes[type]?.config)

  executors.listNodeTypes = async ({ keyword = '' } = {}) => {
    const kw = String(keyword || '').trim().toLowerCase()
    const list = Object.keys(nodes)
      .map((type) => ({
        type,
        name: nodes[type].name,
        description: (nodes[type].description || '').slice(0, 80)
      }))
      .filter((n) => !kw || n.type.toLowerCase().includes(kw) || n.name.toLowerCase().includes(kw))
    return { ok: true, data: { total: list.length, nodes: list.slice(0, 200) } }
  }

  executors.getNodeConfig = async ({ type, detail = false } = {}) => {
    // 两级元信息：默认返回精简概览（快速定位），detail=true 返回完整字段说明；内置节点与插件节点均支持；
    // 每个 type 只构建一次（schema.js 内缓存，取最高版本定义）
    const meta = buildNodeMeta(type, { detail })
    if (!meta) {
      throw new Error(`节点类型 ${type} 不存在，请先用 listNodeTypes 查询可用类型`)
    }
    // 动态枚举注入：remote 字段执行节点定义的 remoteMethod 拉取真实选项（如表 ID、字段选择），
    // 防止模型臆造不存在的值；注入发生在返回副本上，不污染 buildNodeMeta 缓存
    const injectDynamicOptions = async (fields, metaFields) => {
      for (const [fieldId, field] of Object.entries(fields || {})) {
        const mf = metaFields?.[fieldId]
        if (!mf) continue
        if (field.remote === true && typeof field.remoteMethod === 'function') {
          try {
            const opts = await field.remoteMethod('')
            if (Array.isArray(opts) && opts.length > 0) {
              mf.options = opts
              delete mf.dynamic // 已注入真实枚举
            }
          } catch {
            // 动态拉取失败：保留 dynamic 标记，模型可先调用对应列表工具查询
          }
        }
        if (field.fields) await injectDynamicOptions(field.fields, mf.fields)
      }
    }
    const nodeDef = nodes[type]
    for (const [groupKey, group] of Object.entries(nodeDef?.config || {})) {
      await injectDynamicOptions(group.fields, meta.config?.[groupKey]?.fields)
    }
    return { ok: true, data: meta }
  }

  executors.addNode = async ({ type, name, connectTo, handleId, config } = {}) => {
    if (!type) throw new Error('type 必填（用 listNodeTypes 查询可用类型）')
    if (!name) throw new Error('name 必填')
    const nodeDef = nodes[type]
    if (!nodeDef) throw new Error(`节点类型 ${type} 不存在，请先用 listNodeTypes 查询可用类型`)
    const vf = vueFlowRef.value
    if (!vf) throw new Error('画布尚未就绪，请稍等片刻再试')
    if (flowStore.isExecuting) {
      return { ok: false, error: '当前工作流正在执行，暂不能添加节点' }
    }
    const initNodeData = JSON.parse(getInitNodeData(type) || '{}')
    if (!initNodeData.type) throw new Error(`节点类型 ${type} 初始化失败`)
    initNodeData.name = name
    mergeConfig(initNodeData.config, config, nodeFields(type))
    // connectTo 指定前驱节点时，新节点必须与前驱同级（同一主流程/子流程），
    // 否则 autoConnect 会生成跨容器非法连线，导致后续 autoLayout/渲染读 null 崩溃
    if (connectTo) {
      const fromNode = vf.getNode(connectTo)
      if (fromNode && fromNode.parentNode !== initNodeData.parentNode) {
        initNodeData.parentNode = fromNode.parentNode
      }
    }
    // workflowEnd 查重（与画布 useNodeCrud 行为一致）
    if (type === 'workflowEnd') {
      const exists = vf.getNodes.some(
        (n) => n.parentNode === initNodeData.parentNode && n.data?.type === 'workflowEnd'
      )
      if (exists) return { ok: false, error: '当前流程已存在结束节点，禁止重复添加' }
    }
    // 同名去重（与画布 getNodeName 一致）：同级同名节点自动追加序号
    const baseName = initNodeData.name
    const dupCount = vf.getNodes.filter(
      (n) => n.parentNode === initNodeData.parentNode && n.data?.name === baseName
    ).length
    if (dupCount > 0) initNodeData.name = `${baseName}_${dupCount + 1}`
    // 直接经 Vue Flow 实例创建节点（不依赖 FlowCanvas 组件 ref——
    // AI 面板可能先于画布挂载，组件 ref 快照可能为 null 导致 flowRef.value 报错）
    const newNode = {
      id: `node-${uuidv4()}`,
      type: 'custom',
      position: { x: 0, y: 0 },
      parentNode: initNodeData.parentNode,
      selectable: true,
      deletable: true,
      focusable: true,
      data: {
        type: initNodeData.type,
        name: initNodeData.name,
        description: initNodeData.description,
        inputs: initNodeData.inputs,
        outputs: initNodeData.outputs,
        config: initNodeData.config || {},
        status: 'pending',
        view: initNodeData.view,
        version: initNodeData.version || 'V1'
      }
    }
    vf.addNodes([newNode])
    // 子流程节点（subFlow: true，如 workflowLoop）：补建子流程容器 + 容器内起始节点 + 容器连线。
    // 画布手动添加由 useNodeCrud.addSubFlowNode 完成；AI 直连 Vue Flow 实例缺此步骤会导致
    // 容器内 workflowStart 缺失，子流程 view.vue 读 startNode.data 崩溃（Cannot read properties of undefined）
    if (nodeDef.subFlow) {
      const subFlowNode = {
        id: newNode.id + '-subFlow',
        type: 'subFlow',
        parentNode: newNode.id,
        hidden: initNodeData.type === 'workFlow',
        deletable: false,
        position: { x: -30, y: 150 },
        data: {
          type: initNodeData.type,
          name: nodeDef.subFlow?.name || '工作流',
          inputs: [],
          outputs: [],
          config: {},
          status: 'pending',
          view: false
        }
      }
      vf.addNodes([subFlowNode])
      // 子流程容器连线（source: 父节点 subFlow 端口 → target: 容器 subFlow 端口）
      vf.addEdges([
        createConnection({
          source: newNode.id,
          target: subFlowNode.id,
          sourceHandle: 'subFlow',
          targetHandle: 'subFlow',
          selectable: false,
          deletable: false,
          label: nodeDef.subFlow?.name || ''
        })
      ])
      // 容器内添加 workflowStart 起始节点（与 useNodeCrud.addStartNode 等价，extent 约束在容器内）
      const startData = JSON.parse(getInitNodeData('workflowStart') || '{}')
      if (startData.type) {
        startData.deletable = false
        startData.focusable = false
        startData.extent = 'parent'
        startData.parentNode = subFlowNode.id
        vf.addNodes([
          {
            id: `node-${uuidv4()}`,
            type: 'custom',
            position: { x: 180, y: 60 },
            parentNode: subFlowNode.id,
            extent: 'parent',
            selectable: true,
            deletable: false,
            focusable: false,
            data: {
              type: startData.type,
              name: startData.name,
              description: startData.description,
              inputs: startData.inputs,
              outputs: startData.outputs,
              config: startData.config || {},
              status: 'pending',
              view: startData.view,
              version: startData.version || 'V1'
            }
          }
        ])
      }
      // 容器位置：父节点高度下方（等待渲染完成后再移动，避免节点覆盖）
      setTimeout(() => {
        const dims = vf.getNode(newNode.id)?.dimensions
        if (dims) {
          vf.updateNode(subFlowNode.id, (n) => ({
            position: { x: n.position.x, y: n.position.y + dims.height }
          }))
        }
      }, 10)
    }
    // 规则化连接：connectTo 指定前驱节点，端口由 autoConnect 按类型规则自动计算
    if (connectTo) {
      const fromNode = vf.getNode(connectTo)
      if (fromNode) {
        await nextTick()
        autoConnect(vf, createConnection, fromNode, newNode, handleId || 'next')
      }
    }
    // 等 Vue Flow 渲染新节点（计算 dimensions/handles）后再布局，
    // 否则 autoLayout 遍历到未渲染节点可能读 null/undefined 崩溃
    await nextTick()
    autoLayout(vf)
    return attachValidation({ ok: true, data: { id: newNode.id, status: 'created' } })
  }

  executors.connect = async ({ source, target }) => {
    if (!source || !target) throw new Error('source 与 target 必填')
    const sourceNode = vueFlowRef.value?.getNode(source)
    const targetNode = vueFlowRef.value?.getNode(target)
    if (!sourceNode || !targetNode) {
      throw new Error(`节点不存在：${!sourceNode ? source : target}（请用 getWorkflow 或画布快照确认节点ID）`)
    }
    // 规则化连线：端口按节点 outputs/inputs 类型匹配自动计算（与画布拖拽一致）。
    // 预检流程线合法性：source/target 必须同一流程（跨容器连线非法，直接给可读错误，避免生成坏边后崩溃）
    const mainEdge = { source, target, sourceHandle: 'next', targetHandle: 'prev' }
    if (!validateConnection(mainEdge)) {
      const sn = sourceNode.data?.name || source
      const tn = targetNode.data?.name || target
      throw new Error(
        `无法连接「${sn}」与「${tn}」：两者不在同一流程（父容器不同）或「${tn}」没有前置输入。请确认两节点同在主流程或同一子流程内（如需在子流程内添加节点，请用 addNode 的 connectTo）`
      )
    }
    await nextTick()
    autoConnect(vueFlowRef.value, createConnection, sourceNode, targetNode, 'next')
    autoLayout(vueFlowRef.value)
    return attachValidation({ ok: true, data: { status: 'connected' } })
  }

  executors.updateNode = async ({ nodeId, name, config } = {}) => {
    if (!nodeId) throw new Error('nodeId 必填')
    const node = vueFlowRef.value?.getNode(nodeId)
    if (!node) throw new Error(`节点 ${nodeId} 不存在`)
    if (name) node.data.name = String(name)
    mergeConfig(node.data.config, config, nodeFields(node.data.type))
    flowStore?.onNodesChange([{ id: nodeId, type: 'data' }])
    return attachValidation({ ok: true, data: { id: nodeId, status: 'updated' } })
  }

  executors.deleteNode = async ({ nodeId }) => {
    if (!nodeId) throw new Error('nodeId 必填')
    const vf = vueFlowRef.value
    if (!vf) throw new Error('画布尚未就绪，请稍等片刻再试')
    const node = vf.getNode(nodeId)
    if (!node) throw new Error(`节点 ${nodeId} 不存在（请用 getWorkflow 或画布快照确认节点ID）`)
    if (flowStore.isExecuting) {
      return { ok: false, error: '当前工作流正在执行，暂不能删除节点' }
    }
    if (node.data?.type === 'workflowStart') {
      return { ok: false, error: '开始节点不允许删除（已保留）' }
    }
    // 删除关联边 + 节点（与画布 handleNodeDelete 一致，但不依赖 FlowCanvas 组件 ref——
    // 组件 ref 快照在 AI 面板先挂载时可能为 null，flowRef.value 会直接报「null 的 value」）
    const relatedEdges = vf.getEdges.filter((e) => e.source === nodeId || e.target === nodeId)
    if (relatedEdges.length > 0) {
      vf.removeEdges(relatedEdges.map((e) => e.id))
    }
    vf.removeNodes(nodeId, true, true)
    await nextTick()
    autoLayout(vf)
    return attachValidation({ ok: true, data: { id: nodeId, status: 'deleted' } })
  }

  executors.deleteEdge = async ({ edgeId }) => {
    if (!edgeId) throw new Error('edgeId 必填')
    await vueFlowRef.value?.removeEdges([edgeId])
    autoLayout(vueFlowRef.value)
    return attachValidation({ ok: true, data: { id: edgeId, status: 'deleted' } })
  }

  executors.getWorkflows = async ({ keyword = '', page = 1, pageSize = 10 } = {}) => {
    const res = await window.electronAPI.workflow.getWorkflows({ keyword, page, pageSize })
    // 返回前脱敏：列表里的 graph 可能含明文 config（apiKey 等），不发给第三方模型
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
    const masked = { ...res, data: list.map(maskWorkflow) }
    return { ok: true, data: limitText(masked) }
  }

  executors.getWorkflow = async ({ id }) => {
    const res = await window.electronAPI.workflow.getWorkflow(id)
    return { ok: true, data: limitText(maskWorkflow(res)) }
  }

  executors.finish = async () => {
    // 完成前强制检测：工作流未通过运行检查时拒绝 finish，返回修复清单让模型修复后再完成
    const { ok, errors } = quickValidateWorkflow(flowStore)
    if (!ok) {
      return {
        ok: false,
        error: `工作流尚未通过运行检查，请先修复以下问题再调用 finish：\n${errors
          .map((e) => `- ${e.message}`)
          .join('\n')}`
      }
    }
    return { ok: true, data: { status: 'done' } }
  }

  return executors
}
