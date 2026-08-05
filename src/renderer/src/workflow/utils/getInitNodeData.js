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

export const getNodeDefaultConfig = (fields) => {
  const config = {}
  Object.keys(fields).forEach((field) => {
    if (fields[field].fields) {
      if (fields[field].type === 'array') {
        config[field] = fields[field].default || []
      } else {
        config[field] = getNodeDefaultConfig(fields[field].fields)
      }
    } else {
      config[field] = getDefaultFieldValue(fields[field])
    }
  })
  return config
}

export const getInitNodeData = (type, workflowId, isStore) => {
  const node = nodes[type]
  //循环初始化配置（节点定义缺失时（如未注册的 plu_ 插件节点）降级为空配置，避免崩溃）
  let config = {}
  if (node?.config) {
    Object.keys(node.config).forEach((group) => {
      config = Object.assign(config, getNodeDefaultConfig(node.config[group].fields))
    })
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
  return JSON.stringify(nodeData)
}
