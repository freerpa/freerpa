/**
 * @file: 节点字段定义 → JSON Schema / 模型目录 的纯函数转换（同步、无副作用）
 * 统一收敛原 functionCalling.js 与 chat.vue 中两套重复且不一致的转换逻辑。
 */

// 节点字段类型（UI 类型）→ JSON Schema 基础类型
const TYPE_MAP = {
  string: 'string',
  text: 'string',
  input: 'string',
  textarea: 'string',
  code: 'string',
  path: 'string',
  date: 'string',
  time: 'string',
  datetime: 'string',
  color: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  switch: 'boolean',
  array: 'array',
  object: 'object'
}

const toJsonType = (type) => TYPE_MAP[type] || 'string'

/** 单个字段 → JSON Schema（含嵌套 fields 递归） */
const buildFieldSchema = (field) => {
  // 网页元素（type:'selector'）：内嵌元素对象 { name, match_condition, selectors:[{type,text_subtype,expression}] }
  // ——与执行端 selector.js 的结构一致，AI 必须传对象而非字符串
  if (field.type === 'selector') {
    return {
      type: 'object',
      description: (field.description || field.name) + '（网页元素对象，非字符串）',
      properties: {
        name: { type: 'string', description: '元素名称' },
        match_condition: {
          type: 'string',
          enum: ['any', 'all'],
          description: '多选择器命中条件（any=任一命中，all=全部命中）'
        },
        selectors: {
          type: 'array',
          description: '选择器列表（至少 1 个）',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['css', 'xpath', 'text', 'position', 'image'],
                description: 'css=CSS 选择器，xpath=XPath，text=按文本匹配，position=坐标定位，image=图片匹配'
              },
              text_subtype: {
                type: 'string',
                enum: ['start', 'end', 'equals', 'contains'],
                description: '仅 type=text 时使用：文本匹配方式'
              },
              expression: { type: 'string', description: '选择器表达式（css 选择器 / xpath / 文本内容 / 坐标）' }
            },
            required: ['type', 'expression'],
            additionalProperties: false
          }
        }
      },
      required: ['name', 'selectors'],
      additionalProperties: false
    }
  }
  const schema = {}
  if (['radio', 'select'].includes(field.type)) {
    schema.type = 'string'
    const options = field.options || []
    if (options.length > 0) schema.enum = options.map((o) => o.value)
  } else {
    schema.type = toJsonType(field.type)
  }
  if (field.default !== undefined) schema.default = field.default
  if (field.description || field.name) {
    schema.description = field.description || field.name
  }
  const childFields = field.fields && Object.keys(field.fields).length > 0 ? field.fields : null
  if (childFields) {
    if (field.type === 'array') {
      schema.items = buildObjectSchema(childFields)
    } else {
      // object 类型：合并子字段 schema
      Object.assign(schema, buildObjectSchema(childFields))
    }
  }
  return schema
}

/** 一组字段（field.fields / config group.fields）→ object schema */
const buildObjectSchema = (fields) => {
  const properties = {}
  const required = []
  Object.values(fields || {}).forEach((field) => {
    if (!field?.id) return
    if (field.required) required.push(field.id)
    properties[field.id] = buildFieldSchema(field)
  })
  return { type: 'object', properties, required, additionalProperties: false }
}

/**
 * 节点 config（{ groupKey: { name, fields } }）→ JSON Schema
 * 供工具参数（AI 调用 addNode_<type> 时的 config 结构）使用
 */
export const configToJsonSchema = (config) => buildObjectSchema(
  Object.values(config || {}).reduce((all, group) => ({ ...all, ...(group.fields || {}) }), {})
)

// ---- 模型目录（system prompt 注入的节点/端口描述） ----

/** 单个字段 → 目录描述 */
const fieldToCatalog = (field) => ({
  name: field.name,
  description: field.description,
  required: field.required,
  type: field.type,
  default: field.default,
  ...(field.fields && Object.keys(field.fields).length > 0
    ? {
        fields: Object.values(field.fields).reduce(
          (all, item) => ({ ...all, [item.id]: fieldToCatalog(item) }),
          {}
        )
      }
    : {})
})

/** 节点 config → 目录描述（{ fieldId: {...} }） */
export const configToCatalog = (config) =>
  Object.values(config || {}).reduce(
    (all, group) => ({ ...all, ...catalogOfFields(group.fields) }),
    {}
  )

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

const catalogOfFields = (fields) =>
  Object.values(fields || {}).reduce((all, field) => {
    if (!field?.id) return all
    all[field.id] = fieldToCatalog(field)
    return all
  }, {})

/**
 * 节点分类（categories）→ 模型目录数组
 * 返回 [{ group, nodes: [{ type, name, description, subFlow, config, inputs, outputs }] }]
 */
export const buildNodeCatalog = (categories) =>
  Object.values(categories || {}).map(({ name, nodes }) => ({
    group: name,
    nodes: (nodes || []).map((node) => ({
      type: node.type,
      name: node.name,
      description: node.description,
      subFlow: !!node.subFlow,
      config: configToCatalog(node.config),
      inputs: handlesToCatalog(node.inputs),
      outputs: handlesToCatalog(node.outputs)
    }))
  }))
