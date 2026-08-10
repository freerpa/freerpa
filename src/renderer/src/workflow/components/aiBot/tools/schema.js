/**
 * @file: 节点/插件元信息构建（AI 工具与系统提示的纯函数转换）
 * - buildNodeCatalog：精简目录（system prompt 注入，只含 type/名称/描述）
 * - buildNodeMeta：完整元信息（getNodeConfig 返回，含 inputs/outputs/config 字段说明），
 *   按节点类型缓存、每个节点/插件只构建一次（取最高版本定义）
 */
import nodes from '@nodes-path'

// ---- 字段目录（AI 友好的 config 字段说明） ----

const fieldToCatalog = (field) => ({
  name: field.name,
  description: field.description,
  required: field.required,
  type: field.type,
  ...(field.default !== undefined ? { default: field.default } : {}),
  ...(field.defaultValue !== undefined ? { default: field.defaultValue } : {}),
  ...(Array.isArray(field.options) && field.options.length > 0 ? { options: field.options } : {}),
  // 网页元素（type:'selector'）：内嵌元素对象，非字符串（与执行端 selector.js 结构一致）
  ...(field.type === 'selector'
    ? { format: '网页元素对象 { name, match_condition, selectors: [{ type, text_subtype, expression }] }，非字符串' }
    : {}),
  ...(field.fields && Object.keys(field.fields).length > 0
    ? {
        fields: Object.values(field.fields).reduce(
          (all, item) => ({ ...all, [item.id]: fieldToCatalog(item) }),
          {}
        )
      }
    : {})
})

const catalogOfFields = (fields) =>
  Object.values(fields || {}).reduce((all, field) => {
    if (!field?.id) return all
    // UI 隐藏字段（如插件节点的 pluginId/_pluginName 内部字段，由 getInitNodeData 自动生成）
    // 不进入目录，避免误导模型填写
    if (field.show === 'false') return all
    all[field.id] = fieldToCatalog(field)
    return all
  }, {})

/** 节点 config（{ groupKey: { name, fields } }）→ 目录描述（保留分组，AI 按组理解字段归属） */
export const configToCatalog = (config) =>
  Object.entries(config || {}).reduce((all, [key, group]) => {
    all[key] = { name: group?.name || key, fields: catalogOfFields(group?.fields) }
    return all
  }, {})

/** 端口（inputs/outputs）→ 目录描述 */
export const handlesToCatalog = (handles = []) =>
  handles.reduce((all, handle) => {
    if (!handle?.id) return all
    all[handle.id] = {
      name: handle.name,
      description: handle.description,
      type: handle.type,
      required: handle.required
    }
    return all
  }, {})

// ---- 完整元信息（getNodeConfig 返回，按 type 缓存只构建一次） ----

/** 节点/插件定义 → AI 友好完整元信息 */
const nodeToMeta = (def) => ({
  type: def.type,
  name: def.name,
  description: def.description,
  subFlow: !!def.subFlow,
  version: def._version || 'V1',
  inputs: handlesToCatalog(def.inputs),
  outputs: handlesToCatalog(def.outputs),
  config: configToCatalog(def.config)
})

const metaCache = new Map() // type → { def, meta }

/**
 * 构建节点/插件的完整元信息（供 getNodeConfig 返回，AI 按字段说明构造 config）。
 * - 内置节点：nodes[type] 为版本化自动发现选取的最高版本定义（V{n} 最大者）
 * - 本地插件节点（plu_<id>）：注册时的最新 manifest 定义
 * - 每个 type 只构建一次并缓存；定义引用变化（如插件重新注册覆盖）时自动重建
 */
export const buildNodeMeta = (type) => {
  const def = nodes?.[type]
  if (!def) return null
  const cached = metaCache.get(type)
  if (cached && cached.def === def) return cached.meta
  const meta = nodeToMeta(def)
  metaCache.set(type, { def, meta })
  return meta
}

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
