import nodes from '@nodes-path'
import { buildErrorHandleGroup, getConfigFieldGroups } from '../nodes/common.js'

/**
 * 获取节点类型的配置字段分组（含错误处理注入）
 * FlowCanvas（selectedNodeConfigFields）与 useNodeSelection 共用；remoteMethod 由调用方按选中节点注入
 * @param {string} type 节点类型
 * @returns {Object<string, Array>} groupName → 字段数组
 */
export const getNodeConfigFields = (type) => {
  const def = nodes[type]
  if (!def) return {}

  const config = { ...def.config }

  // 为非 start/end 节点注入错误处理配置（remoteMethod 由调用方注入）
  if (type !== 'workflowStart' && type !== 'workflowEnd') {
    config.errorHandle = buildErrorHandleGroup()
  }

  return getConfigFieldGroups({ config })
}
