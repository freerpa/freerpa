import nodes from '@nodes-path'
import { deepClone } from './index'
export const getDefaultFieldValue = (field) => {
  if (field.hasOwnProperty('default')) {
    return deepClone(field.default)
  }
  if (field.type === 'object') {
    return {}
  }
  if (field.type === 'switch') {
    return false
  }
  if (field.type === 'array') {
    return []
  }
  return ''
}

export const getNodeDefaultConfig = (fields = []) => {
  const config = {}
  for (const field of fields) {
    if (!field) continue
    const { id, type, fields: subFields, default: def } = field
    if (subFields) {
      config[id] = type === 'array' ? (def || []) : getNodeDefaultConfig(subFields)
    } else {
      config[id] = getDefaultFieldValue(field)
    }
  }
  return config
}

/**
 * 构建节点实例数据（对象形态）：
 * 取节点定义 → 展开默认 config → 附加元信息（subFlow/version/插件配置快照等）
 * 节点定义缺失时（如未注册的 plu_ 插件节点）降级为空配置，避免崩溃
 */
export const buildNodeData = (type, workflowId, isStore) => {
  const node = nodes[type]
  // 循环初始化配置
  let config = {}
  for (const group of node?.config || []) {
    if (group?.fields) Object.assign(config, getNodeDefaultConfig(group.fields))
  }

  const nodeData = {
    subFlow: node?.subFlow,
    type: type,
    name: node?.name || type,
    view: node?.view,
    inputs: node?.inputs || [],
    outputs: node?.outputs || [],
    config: config,
    version: node?._version || 'V1'
  }
  // 本地插件节点：把插件配置字段定义随节点保存到工作流 json，
  // 即使插件被移除，也能按保存的字段定义渲染配置表单与输入输出
  if (node?._pluginId) {
    nodeData._pluginConfig = node.config
  }
  if (workflowId) {
    nodeData.workflow = {
      id: workflowId,
      isStore
    }
  }
  return nodeData
}

/**
 * 生成节点实例数据 JSON 字符串（drag/drop 与 chooseNode 的 dataTransfer 载体，对外契约保持字符串）
 */
export const getInitNodeData = (type, workflowId, isStore) => {
  return JSON.stringify(buildNodeData(type, workflowId, isStore))
}
