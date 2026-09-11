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

/**
 * 整句截断：超过上限时优先在最近的结束符（；。！？或换行）处截断，避免把描述腰斩成歧义片段；
 * 找不到合适结束符时退回硬切。
 */
const cutSentence = (text, max) => {
  const s = String(text || '')
  if (s.length <= max) return s
  const slice = s.slice(0, max)
  const cut = slice.search(/[；。！？\n]/)
  return cut > 10 ? slice.slice(0, cut + 1) : slice
}

/** show 表达式 → 可读显示条件（仅翻译常见形态，无法翻译返回 null → 保留 conditional 标记） */
const translateShow = (expr) => {
  const s = String(expr || '')
  let m = s.match(/\$\{(\w+)\}\s*===\s*["']([^"']+)["']/)
  if (m) return `仅当「${m[1]}」为「${m[2]}」时显示`
  m = s.match(/\$\{(\w+)\}\s*!==\s*["']([^"']+)["']/)
  if (m) return `仅当「${m[1]}」不为「${m[2]}」时显示`
  m = s.match(/\[\s*(["'][^"']+["'](?:\s*,\s*["'][^"']+["'])*)\s*\]\s*\.includes\(\s*\$\{(\w+)\}\s*\)/)
  if (m) {
    const vals = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])
    return `仅当「${m[2]}」取值为 ${vals.join(' / ')} 时显示`
  }
  return null
}

/** 嵌套字段 → JSON 示例模板（给模型可照抄的结构，降低臆造） */
const sampleOfFields = (fields) =>
  (fields || []).reduce((acc, f) => {
    if (!f?.id) return acc
    if (f.type === 'array' && Array.isArray(f.fields)) acc[f.id] = [sampleOfFields(f.fields)]
    else if (f.type === 'object' && Array.isArray(f.fields)) acc[f.id] = sampleOfFields(f.fields)
    else if (f.default !== undefined && f.default !== null && f.default !== '') acc[f.id] = f.default
    else if (f.type === 'switch') acc[f.id] = false
    else if (f.type === 'number') acc[f.id] = 0
    else if (f.type === 'select' && Array.isArray(f.options) && f.options[0]) {
      acc[f.id] = f.options[0].value ?? f.options[0].label ?? ''
    } else acc[f.id] = ''
    return acc
  }, {})

/** 字段类型（含动态/条件标记）→ AI 友好字段目录 */
const fieldToCatalog = (field, brief) => {
  const out = {
    name: field.name,
    description: brief ? cutSentence(field.description, 120) : field.description,
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
  // 条件显示字段（show 表达式）：常见形态翻译为可读条件，复杂表达式仅标记 conditional
  if (field.show && field.show !== 'false') {
    const when = translateShow(field.show)
    if (when) out.showWhen = when
    else out.conditional = true
  }
  if (brief) return out
  // ---- detail 专属 ----
  // 非空默认值（空字符串/空数组/空对象省略，避免无信息量体积）
  if (field.default !== undefined && !isEmptyDefault(field.default)) out.default = field.default
  if (field.defaultValue !== undefined && !isEmptyDefault(field.defaultValue)) out.default = field.defaultValue
  // 网页元素（type:'selector'）：内嵌元素对象，非字符串（与执行端 selector.js 结构一致）
  if (field.type === 'selector') {
    out.format = '网页元素对象 { name, match_condition, selectors: [{ type, text_subtype, expression }] }，非字符串'
    out.source = '优先用 listElementSets/getElementSet 复用现有元素；无匹配时按上述结构内嵌'
  }
  // 动态 ID 类字段：告知取值来源，避免模型臆造
  if (field.type === 'browser') out.source = '值需从浏览器环境列表获取（浏览器管理模块），不要臆造 ID'
  if (field.type === 'model') out.source = '值需用 listTables 查询数据表 ID，不要臆造'
  if (field.fields && field.fields.length > 0) {
    out.fields = field.fields.reduce(
      (all, item) => ({ ...all, [item.id]: fieldToCatalog(item, brief) }),
      {}
    )
    // 嵌套结构示例：array 给「一个元素的示例」，object 给「对象示例」
    out.example = field.type === 'array' ? [sampleOfFields(field.fields)] : sampleOfFields(field.fields)
  }
  return out
}

const isEmptyDefault = (v) => {
  if (v === '' || v === null || v === undefined) return true
  if (Array.isArray(v) && v.length === 0) return true
  if (typeof v === 'object' && Object.keys(v).length === 0) return true
  return false
}

const catalogOfFields = (fields = [], brief) =>
  fields.reduce((all, field) => {
    if (!field?.id) return all
    // UI 隐藏字段（如插件节点的 pluginId/_pluginName 内部字段，由 getInitNodeData 自动生成）
    // 不进入目录，避免误导模型填写
    if (field.show === 'false') return all
    all[field.id] = fieldToCatalog(field, brief)
    return all
  }, {})

/** 节点 config（数组分组）→ 目录描述（保留分组，AI 按组理解字段归属） */
export const configToCatalog = (config = [], brief = false) =>
  config.reduce((all, group) => {
    all[group?.id || group?.name] = {
      name: group?.name || group?.id || '',
      fields: catalogOfFields(group?.fields, brief)
    }
    return all
  }, {})

/** 端口（inputs/outputs）→ 目录描述；动态端口（type:'dynamic'）标注驱动字段 */
export const handlesToCatalog = (handles = [], brief = false) =>
  handles.reduce((all, handle) => {
    if (!handle?.id) return all
    all[handle.id] = {
      name: handle.name,
      description: brief ? cutSentence(handle.description, 120) : handle.description,
      type: handle.type,
      ...(handle.required ? { required: true } : {}),
      // 动态 IO（dataPath）：端口由配置字段动态生成，模型应关注驱动字段
      ...(handle.type === 'dynamic' && handle.dataPath
        ? { dynamic: true, dataPath: handle.dataPath, drivenBy: `由配置字段「${handle.dataPath}」动态生成` }
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
  description: cutSentence(def.description, brief ? 160 : 400),
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

// ---- 模型目录（system prompt 注入的节点精简描述） ----

/**
 * 节点分类（categories）→ 精简模型目录数组（只含 type/名称/整句截断的描述，
 * 供 system prompt 注入；config 字段明细由 getNodeConfig 工具按需查询，避免 prompt 膨胀）
 * 返回 [{ group, nodes: [{ type, name, description }] }]
 */
export const buildNodeCatalog = (categories) =>
  Object.values(categories || {}).map(({ name, nodes }) => ({
    group: name,
    nodes: (nodes || []).map((node) => ({
      type: node.type,
      name: node.name,
      description: cutSentence(node.description, 120)
    }))
  }))
