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
import { quickValidateWorkflow, validateWorkflow } from '@/workflow/engine/validate'
import { parseConfigExpression } from '@/workflow/utils/parseConfigExpression'
import { createWorkflowTools } from './workflowTools.js'

export { createWorkflowTools }

/** 扁平化节点 config 字段定义：{ [fieldId]: { type, default, options } }（供容错合并） */
const flattenConfigFields = (configGroups = []) => {
  const fields = {}
  for (const group of configGroups) {
    for (const field of group?.fields || []) {
      if (field?.id) fields[field.id] = field
    }
  }
  return fields
}

/**
 * 字段当前是否显示：`show` 条件未满足的字段不参与必填/枚举校验（与画布表单一致）。
 * 解析复用画布同一套表达式（parseConfigExpression），避免 AI 与 UI 判定不一致。
 */
const isFieldVisible = (field, config, fields) => {
  if (field?.show === undefined) return true
  if (field.show === false || field.show === 'false') return false
  try {
    return !!parseConfigExpression(fields, 'show', String(field.show), config || {})
  } catch {
    return true
  }
}

/** 是否为参数引用（简写 {{节点.输出}} 或内部完整格式都算） */
const isReferValue = (value) =>
  typeof value === 'string' && value.includes('{{') && value.includes('}}')

/** 元素选择器值的结构校验：必须是元素对象（name + selectors[{type, expression}]），或参数引用 */
const selectorIssue = (value) => {
  if (typeof value === 'string') {
    return isReferValue(value) ? '' : '元素选择器必须是元素对象 {name, match_condition, selectors:[...]}'
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '元素选择器必须是元素对象 {name, match_condition, selectors:[...]}'
  }
  if (!String(value.name || '').trim()) return '元素选择器缺少元素名称（name）'
  if (!Array.isArray(value.selectors) || value.selectors.length === 0) {
    return '元素选择器缺少定位规则（selectors 至少 1 条）'
  }
  const bad = value.selectors.some(
    (selector) => !selector?.type || !String(selector?.expression || '').trim()
  )
  return bad ? '元素选择器的定位规则缺少 type 或 expression' : ''
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

/**
 * 容错合并 config：只取节点字段定义中存在的字段，按类型转换，忽略未知字段。
 * 返回被忽略的字段名列表——回执给模型，让它在下一轮用正确字段 ID 修正，而不是静默丢弃后继续错下去。
 */
const mergeConfig = (targetConfig, input, fields) => {
  const ignored = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ignored
  Object.keys(input).forEach((key) => {
    const field = fields[key]
    if (!field) {
      ignored.push(key)
      return
    }
    const value = coerceValue(input[key], field)
    if (value !== undefined) targetConfig[key] = value
  })
  return ignored
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
  // 结果结构化为 data.validation（AI 每次工具调用都能看到当前校验状态），
  // 有问题时再给 warning（与系统提示「warning 请修正后重试」一致）。
  // 除结构校验外，把全量必填/枚举/元素选择器问题一起回执，让模型在下一步就能看见并修正。
  const attachValidation = (result) => {
    const { ok, errors } = quickValidateWorkflow(flowStore)
    const issues = [...errors.map((e) => e.message), ...(collectAllConfigIssues?.() || [])]
    result.data = { ...(result.data || {}), validation: { ok: ok && issues.length === 0, issues } }
    if (issues.length > 0) {
      result.warning = `工作流校验未通过：${issues.join('；')}`
    }
    return result
  }

  // AI 改动后自动静默保存到数据库：force 跳过 isSaved 短路——AI 改动后 saveHistory 是 100ms debounce，
  // 此刻 nowHistoryId 尚未更新，isSaved 可能仍为 true，不 force 会导致「改动了却不落库」，刷新即丢失；
  // 保存失败由 saveWorkflow 内部打日志（silent 不弹窗），工具结果不受影响
  const autoSave = () => flowStore.saveWorkflow({ silent: true, force: true })

  /**
   * 节点引用解析：优先节点 ID，否则按节点名称查找（AI 并行创建多个节点时用名称连接，避免依赖事后才返回的 ID）。
   * preferLatest：同名节点取最后创建的那个——同一批里连续创建同名节点会被自动加序号，
   * 后续节点的 connectTo 写的是原始名称，取最新才能连到“刚创建的那个”，而不是更早的同名节点。
   */
  const resolveNodeRef = (ref, { preferLatest = false } = {}) => {
    const vf = vueFlowRef.value
    if (!ref || !vf) return undefined
    const byId = vf.getNode(ref)
    if (byId) return byId
    const name = String(ref).trim()
    const matches = vf.getNodes.filter((n) => n.data?.name === name)
    return preferLatest ? matches[matches.length - 1] : matches[0]
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

  /**
   * 单个节点的配置问题（创建/更新后立即回执）：必填缺失 + 枚举取值非法 + 元素选择器结构。
   * `show` 条件按字段当前值动态求值：条件满足的字段才参与校验（与画布表单一致）。
   * 参数引用值跳过枚举/结构校验。让模型在当轮就能修正，而不是等到 finish 才被拒绝。
   */
  const nodeConfigIssues = (node) => {
    const issues = []
    const groups = nodes[node?.data?.type]?.config || []
    const config = node?.data?.config || {}
    // 显隐表达式可能跨分组引用，用全部顶层字段求值
    const fields = Object.values(flattenConfigFields(groups))
    const isEmptyValue = (value) =>
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)

    for (const group of groups) {
      for (const field of group.fields || []) {
        if (!field?.id || !isFieldVisible(field, config, fields)) continue
        const value = config[field.id]
        const isRefer = isReferValue(value)
        if (field.required && isEmptyValue(value)) {
          issues.push(`缺少必填配置「${field.name || field.id}」(字段ID: ${field.id})`)
          continue
        }
        // 元素选择器：必须是元素对象，避免模型塞字符串/空对象后运行时报“未找到元素”
        if (field.type === 'selector' && !isEmptyValue(value) && !isRefer) {
          const issue = selectorIssue(value)
          if (issue) issues.push(`「${field.name || field.id}」${issue}`)
        }
        // 数组字段：逐项检查必填子字段（子字段自身的 show 也按该项的值求值）
        if (Array.isArray(value) && Array.isArray(field.fields)) {
          const subFields = field.fields
          value.forEach((item, index) => {
            const itemValues = { ...config, ...(item || {}) }
            for (const sub of subFields) {
              if (!sub?.id || !sub.required) continue
              if (!isFieldVisible(sub, itemValues, [...fields, ...subFields])) continue
              const subValue = item?.[sub.id]
              if (isEmptyValue(subValue)) {
                issues.push(`「${field.name || field.id}」第 ${index + 1} 项缺少必填的「${sub.name || sub.id}」`)
              } else if (sub.type === 'selector' && !isReferValue(subValue)) {
                const subIssue = selectorIssue(subValue)
                if (subIssue) {
                  issues.push(`「${field.name || field.id}」第 ${index + 1} 项的「${sub.name || sub.id}」${subIssue}`)
                }
              }
            }
          })
        }
        if (Array.isArray(field.options) && field.options.length > 0 && !isRefer) {
          const allowed = field.options.map((o) => o?.value ?? o?.label).filter((v) => v !== undefined)
          const values = Array.isArray(value) ? value : [value]
          const invalidValues = values.filter(
            (item) =>
              item !== undefined &&
              item !== null &&
              item !== '' &&
              !allowed.some((option) => String(option) === String(item))
          )
          if (invalidValues.length > 0) {
            issues.push(
              `「${field.name || field.id}」取值 ${JSON.stringify(invalidValues)} 不在可选范围（${allowed
                .slice(0, 8)
                .join(' / ')}）`
            )
          }
        }
      }
    }
    return issues
  }

  /** finish 前全量配置检查：遍历画布所有节点，返回带节点名的可读问题清单 */
  const collectAllConfigIssues = () => {
    const vf = vueFlowRef.value
    const issues = []
    for (const node of vf?.getNodes || []) {
      const nodeIssues = nodeConfigIssues(node)
      nodeIssues.forEach((issue) => issues.push(`节点【${node.data?.name || node.id}】${issue}`))
    }
    return issues
  }

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
      for (const field of fields || []) {
        const mf = field?.id ? metaFields?.[field.id] : undefined
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
    for (const group of nodeDef?.config || []) {
      await injectDynamicOptions(group?.fields, meta.config?.[group?.id]?.fields)
    }
    return { ok: true, data: meta }
  }

  executors.addNode = async ({ type, name, connectTo, handleId, config } = {}) => {
    console.info('[AI addNode] 开始', { type, name, connectTo, handleId, config })
    if (!type) throw new Error('type 必填（用 listNodeTypes 查询可用类型）')
    if (!name) throw new Error('name 必填')
    const nodeDef = nodes[type]
    if (!nodeDef) throw new Error(`节点类型 ${type} 不存在，请先用 listNodeTypes 查询可用类型`)
    const vf = vueFlowRef.value
    if (!vf) throw new Error('画布尚未就绪，请稍等片刻再试')
    if (flowStore.isExecuting) {
      return { ok: false, error: '当前工作流正在执行，暂不能添加节点' }
    }
    console.info('[AI addNode] 画布状态', {
      nodeCount: vf.getNodes.length,
      edgeCount: vf.getEdges.length,
      isExecuting: flowStore.isExecuting,
      workflowId
    })
    const initNodeData = JSON.parse(getInitNodeData(type) || '{}')
    if (!initNodeData.type) throw new Error(`节点类型 ${type} 初始化失败`)
    initNodeData.name = name
    const ignoredConfig = mergeConfig(initNodeData.config, config, nodeFields(type))
    // connectTo 指定前驱节点时，新节点必须与前驱同级（同一主流程/子流程），
    // 否则 autoConnect 会生成跨容器非法连线，导致后续 autoLayout/渲染读 null 崩溃。
    // 同名节点取最新创建的：同一批连续 create 同名节点会被自动加序号，后续 connectTo 写原始名称时应连到最近那个
    let fromNode = null
    if (connectTo) {
      fromNode = resolveNodeRef(connectTo, { preferLatest: true })
      if (!fromNode) {
        return { ok: false, error: `找不到前驱节点【${connectTo}】（可用节点名称或ID）` }
      }
      if (fromNode.parentNode !== initNodeData.parentNode) {
        initNodeData.parentNode = fromNode.parentNode
      }
    }
    // 开始节点由系统自动创建（空流程首次打开画布时补齐，子流程容器创建时也会补建），
    // 外部 Agent 重复添加会让同一流程出现多个起点；这里直接返回已有节点，不再新建
    if (type === 'workflowStart') {
      const exists = vf.getNodes.find(
        (n) => n.parentNode === initNodeData.parentNode && n.data?.type === 'workflowStart'
      )
      if (exists) {
        // 开始节点不会新建，但传入的 config 必须生效：模型常用 addNode(workflowStart, config)
        // 配置「配置项/输入项」，此前直接返回 exists 会把 config 静默丢弃
        const startIgnored = mergeConfig(exists.data.config, config, nodeFields(type))
        let startWarning = ''
        if (config && Object.keys(config).length > 0) {
          flowStore?.onNodesChange([{ id: exists.id, type: 'data' }])
          await autoSave()
        }
        const result = attachValidation({
          ok: true,
          data: {
            id: exists.id,
            name: exists.data?.name,
            type,
            status: 'exists',
            note: '开始节点由系统自动创建，无需手动添加（config 已写入现有节点）'
          }
        })
        if (startIgnored.length > 0) {
          result.data.ignoredConfig = startIgnored
          startWarning = `配置字段 ${startIgnored.join('、')} 在该节点中不存在，已忽略。请调用 getNodeConfig(type="workflowStart") 核对字段ID后重试。`
          result.warning = result.warning ? `${result.warning}；${startWarning}` : startWarning
        }
        return result
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
    const nameAdjusted = dupCount > 0
    if (nameAdjusted) initNodeData.name = `${baseName}_${dupCount + 1}`
    // 直接经 Vue Flow 实例创建节点（不依赖 FlowCanvas 组件 ref——
    // AI 面板可能先于画布挂载，组件 ref 快照可能为 null 导致 flowRef.value 报错）
    const newNode = {
      id: `node-${uuidv4()}`,
      type: 'custom',
      position: { x: 0, y: 0 },
      parentNode: initNodeData.parentNode,
      selectable: true,
      // 开始节点不可删除（与画布行为一致）
      deletable: initNodeData.type !== 'workflowStart',
      focusable: initNodeData.type !== 'workflowStart',
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
    console.info('[AI addNode] 已添加节点', {
      id: newNode.id,
      type,
      name: initNodeData.name,
      parentNode: newNode.parentNode,
      nodeCount: vf.getNodes.length,
      subFlow: !!nodeDef.subFlow
    })
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
    if (fromNode) {
      await nextTick()
      autoConnect(vf, createConnection, fromNode, newNode, handleId || 'next')
    }
    // 等 Vue Flow 渲染新节点（计算 dimensions/handles）后再布局，
    // 否则 autoLayout 遍历到未渲染节点可能读 null/undefined 崩溃
    await nextTick()
    autoLayout(vf)
    // 连接结果回执：autoConnect 在端口不匹配时会静默跳过，必须显式告诉模型“这条线没连上”
    const flowConnected = !!fromNode && vf.getEdges.some(
      (edge) => edge.source === fromNode.id && edge.target === newNode.id && edge.targetHandle === 'prev'
    )
    const result = attachValidation({
      ok: true,
      data: {
        id: newNode.id,
        name: initNodeData.name,
        type,
        status: 'created',
        connected: flowConnected
      }
    })
    if (!connectTo) {
      result.warning = `节点【${initNodeData.name}】创建时未指定 connectTo，当前处于未连接状态。请用 connect(source=前驱, target="${initNodeData.name}") 补连线，否则流程无法运行。`
    } else if (!flowConnected) {
      result.warning = `节点【${initNodeData.name}】与【${fromNode?.data?.name || connectTo}】的流程连线未建立（端口类型不匹配或对端无对应输入）。请检查 getNodeConfig 的输入输出后改用 connect 补连。`
    }
    if (nameAdjusted) {
      const message = `节点名称「${baseName}」已存在，当前节点最终名称为「${initNodeData.name}」，后续连接/更新请使用最终名称。`
      result.warning = result.warning ? `${result.warning}；${message}` : message
    }
    // 配置字段纠正回执：模型填错字段 ID 时不再静默丢弃，而是明确告诉它正确做法
    if (ignoredConfig.length > 0) {
      result.data.ignoredConfig = ignoredConfig
      const message = `配置字段 ${ignoredConfig.join('、')} 在该节点中不存在，已忽略。请调用 getNodeConfig(type="${type}") 核对字段ID后，用 updateNode 修正。`
      result.warning = result.warning ? `${result.warning}；${message}` : message
    }
    // 当前节点配置问题回执：必填缺失 / 枚举值非法，当轮就能修正
    const configIssues = nodeConfigIssues(newNode)
    if (configIssues.length > 0) {
      result.data.configIssues = configIssues
      const message = `节点【${initNodeData.name}】配置待完善：${configIssues.join('；')}。请调用 getNodeConfig(type="${type}") 核对后用 updateNode 补全。`
      result.warning = result.warning ? `${result.warning}；${message}` : message
    }
    console.info('[AI addNode] 完成', {
      id: newNode.id,
      type,
      name: initNodeData.name,
      nodeCount: vf.getNodes.length,
      result
    })
    await autoSave()
    return result
  }

  executors.connect = async ({ source, target, handleId = 'next', sourceHandle, targetHandle } = {}) => {
    if (!source || !target) throw new Error('source 与 target 必填')
    const sourceNode = resolveNodeRef(source)
    const targetNode = resolveNodeRef(target)
    if (!sourceNode || !targetNode) {
      const current = (vueFlowRef.value?.getNodes || [])
        .map((n) => `${n.data?.name}(id:${n.id})`)
        .join('、')
      throw new Error(
        `节点不存在：${!sourceNode ? source : target}（节点可用名称或ID；当前画布节点：${current}）`
      )
    }
    const vf = vueFlowRef.value
    if (!vf) throw new Error('画布尚未就绪，请稍等片刻再试')
    // 显式指定端口时按“数据连线”处理（如 page/data 端口）；否则按流程主线连接，
    // handleId 支持 workflowIf 的 next-false 分支。端口预检用解析后的节点 ID（模型传的名称会被当成 ID 查不到）。
    const connection = sourceHandle && targetHandle
      ? { source: sourceNode.id, target: targetNode.id, sourceHandle, targetHandle }
      : { source: sourceNode.id, target: targetNode.id, sourceHandle: handleId || 'next', targetHandle: 'prev' }
    if (!validateConnection(connection)) {
      const sn = sourceNode.data?.name || source
      const tn = targetNode.data?.name || target
      throw new Error(
        `无法连接「${sn}」与「${tn}」（${connection.sourceHandle} → ${connection.targetHandle}）：两者不在同一流程、端口不存在/类型不匹配，或该连线已存在。` +
        '流程主线用 handleId=next/next-false；数据端口请按 getNodeConfig 的 inputs/outputs id 传 sourceHandle/targetHandle。'
      )
    }
    await nextTick()
    if (!sourceHandle) {
      // 流程主线：autoConnect 会同时补齐可由类型推断的数据端口（如 page 输入）
      autoConnect(vf, createConnection, sourceNode, targetNode, handleId || 'next')
    } else {
      vf.addEdges([createConnection(connection)])
    }
    autoLayout(vf)
    await autoSave()
    const connected = vf.getEdges.some(
      (edge) =>
        edge.source === sourceNode.id &&
        edge.target === targetNode.id &&
        edge.sourceHandle === connection.sourceHandle &&
        edge.targetHandle === connection.targetHandle
    )
    return attachValidation({
      ok: true,
      data: { status: connected ? 'connected' : 'unchanged', ...connection }
    })
  }

  executors.updateNode = async ({ nodeId, name, config } = {}) => {
    if (!nodeId) throw new Error('nodeId 必填')
    // nodeId 同时支持节点ID与节点名称（模型经常只记得名称）
    const node = resolveNodeRef(nodeId)
    if (!node) {
      const current = (vueFlowRef.value?.getNodes || []).map((n) => `${n.data?.name}(id:${n.id})`).join('、')
      throw new Error(`节点 ${nodeId} 不存在（可用节点名称或ID；当前画布节点：${current}）`)
    }
    if (name) node.data.name = String(name)
    const ignoredConfig = mergeConfig(node.data.config, config, nodeFields(node.data.type))
    flowStore?.onNodesChange([{ id: node.id, type: 'data' }])
    await autoSave()
    const result = attachValidation({
      ok: true,
      data: { id: node.id, name: node.data.name, status: 'updated' }
    })
    if (ignoredConfig.length > 0) {
      result.data.ignoredConfig = ignoredConfig
      const message = `配置字段 ${ignoredConfig.join('、')} 在该节点中不存在，已忽略。请调用 getNodeConfig(type="${node.data.type}") 核对字段ID后重试。`
      result.warning = result.warning ? `${result.warning}；${message}` : message
    }
    // 当前节点配置问题回执：必填缺失 / 枚举值非法，当轮就能修正
    const configIssues = nodeConfigIssues(node)
    if (configIssues.length > 0) {
      result.data.configIssues = configIssues
      const message = `节点【${node.data.name}】配置待完善：${configIssues.join('；')}。请调用 getNodeConfig(type="${node.data.type}") 核对后修正。`
      result.warning = result.warning ? `${result.warning}；${message}` : message
    }
    return result
  }

  executors.deleteNode = async ({ nodeId }) => {
    if (!nodeId) throw new Error('nodeId 必填')
    const vf = vueFlowRef.value
    if (!vf) throw new Error('画布尚未就绪，请稍等片刻再试')
    const node = resolveNodeRef(nodeId)
    if (!node) throw new Error(`节点 ${nodeId} 不存在（可用节点名称或ID；请用 getWorkflow 或画布快照确认）`)
    const id = node.id
    if (flowStore.isExecuting) {
      return { ok: false, error: '当前工作流正在执行，暂不能删除节点' }
    }
    if (node.data?.type === 'workflowStart') {
      // 流程必须保留至少一个开始节点；存在多个时允许删除多余的（用于清理历史数据）
      const starts = vf.getNodes.filter(
        (n) => n.parentNode === node.parentNode && n.data?.type === 'workflowStart'
      )
      if (starts.length <= 1) {
        return { ok: false, error: '开始节点不允许删除（每个流程必须保留一个开始节点）' }
      }
    }
    // 删除关联边 + 节点（与画布 handleNodeDelete 一致，但不依赖 FlowCanvas 组件 ref——
    // 组件 ref 快照在 AI 面板先挂载时可能为 null，flowRef.value 会直接报「null 的 value」）
    const relatedEdges = vf.getEdges.filter((e) => e.source === id || e.target === id)
    if (relatedEdges.length > 0) {
      vf.removeEdges(relatedEdges.map((e) => e.id))
    }
    vf.removeNodes(id, true, true)
    await nextTick()
    autoLayout(vf)
    await autoSave()
    return attachValidation({ ok: true, data: { id, status: 'deleted' } })
  }

  executors.deleteEdge = async ({ edgeId }) => {
    if (!edgeId) throw new Error('edgeId 必填')
    await vueFlowRef.value?.removeEdges([edgeId])
    autoLayout(vueFlowRef.value)
    await autoSave()
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
    // 完成前强制检测：结构校验 + 全量必填/枚举/元素选择器检查 + 节点表单深度校验。
    // 任一未通过都拒绝 finish，把修复清单回给模型，避免“看起来建完了但跑不起来”。
    const quick = quickValidateWorkflow(flowStore)
    const configIssues = collectAllConfigIssues()
    let deepErrors = []
    try {
      const deep = await validateWorkflow(flowStore, { deep: true })
      deepErrors = (deep?.errors || [])
        .filter((error) => error.code === 'config-invalid')
        .map((error) => error.message)
    } catch (error) {
      console.warn('finish 深度校验失败（忽略节点表单校验）:', error)
    }
    const issues = [
      ...(quick.ok ? [] : quick.errors.map((e) => e.message)),
      ...configIssues,
      ...deepErrors
    ]
    // 去重（节点表单校验与全量配置检查可能报同一问题）
    const uniqueIssues = [...new Set(issues)]
    if (!quick.ok || uniqueIssues.length > 0) {
      return {
        ok: false,
        error: `工作流尚未通过运行检查，请先修复以下问题再调用 finish：\n${uniqueIssues
          .map((message) => `- ${message}`)
          .join('\n')}`
      }
    }
    return { ok: true, data: { status: 'done' } }
  }

  return executors
}
