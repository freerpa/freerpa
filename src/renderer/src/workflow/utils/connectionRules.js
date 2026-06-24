import { useFlowStore } from '../store'
import { v4 as uuidv4 } from 'uuid'

export class ConnectionRules {
  constructor(workflowId) {
    this.workflowId = workflowId
  }

  /**
   * 验证连线规则
   * @param {Object} connection 连线信息
   */
  validateConnection = (
    { source, target, sourceHandle, targetHandle },
    justCheck = false,
    isHistorying = false
  ) => {
    const { vueFlowRef } = useFlowStore(this.workflowId)
    const nodes = vueFlowRef.getNodes
    const edges = vueFlowRef.getEdges
    // 禁止自己连自己
    if (source === target) {
      return false
    }

    // 检查是否已存在相同的连线或输入已被占用
    const existingConnection = edges.some((el) => {
      if (!el.source || !el.target) return false

      // 检查完全相同的连线
      const isSameConnection =
        el.source === source &&
        el.target === target &&
        el.sourceHandle === sourceHandle &&
        el.targetHandle === targetHandle

      // 检查输入是否被占用
      // const isInputOccupied =
      //   el.target === target &&
      //   el.targetHandle === targetHandle &&
      //   !['next', 'next-false'].includes(el.sourceHandle)

      return isSameConnection
    })

    if (justCheck !== true && existingConnection) return false

    // 只能从输出连到输入
    const sourceNode = nodes.find((el) => el.id === source)
    const targetNode = nodes.find((el) => el.id === target)
    if (!sourceNode || !targetNode) return false

    // 子流程节点不能连线
    // if (sourceNode.type === 'subFlow' || targetNode.type === 'subFlow') {
    //   return false
    // }

    //非同级节点不能连线（恢复历史除外）
    if (sourceNode.parentNode !== targetNode.parentNode && !sourceNode.data?.global && !isHistorying) {
      return false
    }

    const sourceOutput = sourceNode.data.outputs?.find((o) => o.id === sourceHandle)
    const targetInput = targetNode.data.inputs?.find((i) => i.id === targetHandle)

    // 如果sourceHandle是next，targetHandle是prev，则允许连线
    if ((sourceHandle === 'next' || sourceHandle === 'next-false') && targetHandle === 'prev') {
      if (sourceNode.parentNode == targetNode.parentNode || isHistorying) {
        return true
      } else {
        return false
      }
    } else if (!sourceOutput || !targetInput) {
      return false
    }

    // 4. 检查数据类型是否匹配
    let sourceType = sourceOutput.type || 'string'
    let targetType = targetInput.type || 'string'

    if (typeof sourceType == 'string') {
      sourceType = [sourceType]
    }

    if (typeof targetType == 'string') {
      targetType = [targetType]
    }

    return (
      sourceType.some((type) => targetType.includes(type)) ||
      targetType.some((type) => sourceType.includes(type)) ||
      targetType.includes('any') ||
      sourceType.includes('any')
    )
  }

  /**
   * 获取连线样式
   * @param {Object} connection 连线信息
   * @returns {Object} 连线样式
   */
  getConnectionStyle = (connection) => {
    if (connection.sourceHandle === 'next' && connection.targetHandle === 'prev') {
      return {
        type: 'custom',
        style: {
          strokeWidth: 4
        },
        animated: true
      }
    } else if (connection.sourceHandle === 'next-false' && connection.targetHandle === 'prev') {
      return {
        type: 'custom',
        style: {
          strokeWidth: 4
        },
        animated: true
      }
    } else {
      return {
        type: 'custom',
        style: {
          strokeWidth: 2
        },
        animated: true
      }
    }
  }

  /**
   * 创建新的连线
   * @param {Object} connection 连线信息
   * @returns {Object} 新的连线对象
   */
  createConnection = (connection) => {
    let selectable = true
    if (connection.hasOwnProperty('selectable')) {
      selectable = connection.selectable
    }
    let deletable = true
    if (connection.hasOwnProperty('deletable')) {
      deletable = connection.deletable
    }
    return {
      id: 'edge-' + uuidv4(),
      source: connection.source,
      target: connection.target,
      label: connection.label,
      selectable,
      deletable,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      ...this.getConnectionStyle(connection)
    }
  }
}
