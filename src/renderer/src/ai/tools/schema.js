/**
 * @file: 节点/插件元信息构建（AI 工具与系统提示的纯函数转换）
 * 两级结构（参照 nodeConfigTemplate.md 的字段规范，控制 prompt 体积）：
 * - short 概览（buildNodeMeta(type, {detail:false}) 默认）：只含必填输入/输出类型/关键字段
 *   （必填、静态枚举、动态枚举 remote、条件显示 conditional），供快速定位节点用途
 * - detail 详情（buildNodeMeta(type, {detail:true})）：完整字段说明（default/options/嵌套 fields），
 *   按需由 getNodeConfig(detail=true) 获取
 * - buildNodeCatalog：精简目录（system prompt 注入，只含 type/名称/描述）
 */
import nodes from '@nodes-path'

/** 字段类型（含动态/条件标记）→ AI 友好字段目录 */
const fieldToCatalog = (field, brief) => {
  const out = {
    name: field.name,
    description: brief ? (field.description || '').slice(0, 40) : field.description,
    type: field.type
  }
  if (field.required) out.required = true
  // 静态枚举（select/radio/checkbox）：short 只给前 3 项示意，detail 全量
  const options = Array.isArray(field.options) ? field.options : []
  if (options.length > 0) {
    out.options = brief ? options.slice(0, 3) : options
  }
  // 远程动态枚举（remote/remoteMethod）：标记待动态注入，short 与 detail 均提示
  if (field.remote === true) out.dynamic = true
  // 条件显示字段（show 表达式）：只标记为条件字段，不暴露表达式细节
  if (field.show && field.show !== 'false') out.conditional = true
  if (brief) return out
  // ---- detail 专属 ----
  // 非空默认值（空字符串/空数组/空对象省略，避免无信息量体积）
  if (field.default !== undefined && !isEmptyDefault(field.default)) out.default = field.default
  if (field.defaultValue !== undefined && !isEmptyDefault(field.defaultValue)) out.default = field.defaultValue
  // 网页元素（type:'selector'）：内嵌元素对象，非字符串（与执行端 selector.js 结构一致）
  if (field.type === 'selector') {
    out.format = '网页元素对象 { name, match_condition, selectors: [{ type, text_subtype, expression }] }，非字符串'
  }
  if (field.fields && Object.keys(field.fields).length > 0) {
    out.fields = Object.values(field.fields).reduce(
      (all, item) => ({ ...all, [item.id]: fieldToCatalog(item, brief) }),
      {}
    )
  }
  return out
}

const isEmptyDefault = (v) => {
  if (v === '' || v === null || v === undefined) return true
  if (Array.isArray(v) && v.length === 0) return true
  if (typeof v === 'object' && Object.keys(v).length === 0) return true
  return false
}

const catalogOfFields = (fields, brief) =>
  Object.values(fields || {}).reduce((all, field) => {
    if (!field?.id) return all
    // UI 隐藏字段（如插件节点的 pluginId/_pluginName 内部字段，由 getInitNodeData 自动生成）
    // 不进入目录，避免误导模型填写
    if (field.show === 'false') return all
    all[field.id] = fieldToCatalog(field, brief)
    return all
  }, {})

/** 节点 config（{ groupKey: { name, fields } }）→ 目录描述（保留分组，AI 按组理解字段归属） */
export const configToCatalog = (config, brief = false) =>
  Object.entries(config || {}).reduce((all, [key, group]) => {
    all[key] = { name: group?.name || key, fields: catalogOfFields(group?.fields, brief) }
    return all
  }, {})

/** 端口（inputs/outputs）→ 目录描述；动态端口（type:'dynamic'）标注 dataPath 驱动字段 */
export const handlesToCatalog = (handles = [], brief = false) =>
  handles.reduce((all, handle) => {
    if (!handle?.id) return all
    all[handle.id] = {
      name: handle.name,
      description: brief ? (handle.description || '').slice(0, 40) : handle.description,
      type: handle.type,
      ...(handle.required ? { required: true } : {}),
      // 动态 IO（dataPath）：端口由配置字段动态生成，模型应关注驱动字段
      ...(handle.type === 'dynamic' && handle.dataPath
        ? { dynamic: true, dataPath: handle.dataPath }
        : {})
    }
    return all
  }, {})

/**
 * 节点/插件定义 → 元信息（brief 概览 或 完整详情）
 * brief：输入只保留 required 端口，输出全量（精简类型）；字段只含必填/枚举/动态/条件标记
 */
const nodeToMeta = (def, brief) => ({
  type: def.type,
  name: def.name,
  description: (def.description || '').slice(0, brief ? 80 : 200),
  subFlow: !!def.subFlow,
  version: def._version || 'V1',
  inputs: handlesToCatalog(def.inputs, brief),
  outputs: handlesToCatalog(def.outputs, brief),
  config: configToCatalog(def.config, brief)
})

const metaCache = new Map() // `${type}|brief|detail` → { def, meta }

/**
 * 构建节点/插件的元信息（供 getNodeConfig 返回，AI 按字段说明构造 config）。
 * - brief（默认）：精简概览，快速定位节点用途与关键字段
 * - detail：完整字段说明（default/options/嵌套 fields/动态 IO）
 * - 内置节点取最高版本定义；插件节点取注册时的最新 manifest；定义引用变化（插件重注册）自动重建
 */
export const buildNodeMeta = (type, { detail = false } = {}) => {
  const def = nodes?.[type]
  if (!def) return null
  const key = `${type}|${detail ? 'detail' : 'brief'}`
  const cached = metaCache.get(key)
  if (cached && cached.def === def) return cached.meta
  const meta = nodeToMeta(def, !detail)
  metaCache.set(key, { def, meta })
  return meta
}

/** 兼容旧调用：概览模式（不传 detail 时为精简版） */
export const buildNodeMetaShort = (type) => buildNodeMeta(type)

// ---- 模型目录（system prompt 注入的节点精简描述） ----

/**
 * 节点分类（categories）→ 精简模型目录数组（只含 type/名称/描述前 80 字符，
 * 供 system prompt 注入；config 字段明细由 getNodeConfig 工具按需查询，避免 prompt 膨胀）
 * 返回 [{ group, nodes: [{ type, name, description }] }]
 */
export const buildNodeCatalog = (categories) =>
  Object.values(categories || {}).map(({ name, nodes }) => ({
    group: name,
    nodes: (nodes || []).map((node) => ({
      type: node.type,
      name: node.name,
      description: (node.description || '').slice(0, 80)
    }))
  }))
