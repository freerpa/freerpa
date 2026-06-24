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
  //循环初始化配置
  let config = {}
  Object.keys(node.config).forEach((group) => {
    config = Object.assign(config, getNodeDefaultConfig(node.config[group].fields))
  })

  const nodeData = {
    subFlow: node.subFlow,
    type: node.type,
    name: node.name,
    view: node.view,
    inputs: node.inputs,
    outputs: node.outputs,
    config: config
  }
  if (workflowId) {
    nodeData.workflow = {
      id: workflowId,
      isStore
    }
  }
  return JSON.stringify(nodeData)
}
