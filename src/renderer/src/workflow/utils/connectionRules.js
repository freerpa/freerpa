import { useFlowStore } from '../store'
import { v4 as uuidv4 } from 'uuid'
import { isTypeConnectable } from './typeMatch'

export class ConnectionRules {
  constructor(workflowId) {
    this.workflowId = workflowId
    // handle→IO Map 缓存：以 node.data.outputs/inputs 数组引用为失效信号（useNodeIO 每次解析生成新数组 → 自动失效重建）
    this._handleCache = new Map()
  }

  /**
   * 获取节点某侧 handle→IO 的 Map（缓存，避免拖线高频校验时 O(n) find）
   * @param {Object} node 节点对象
   * @param {'outputs'|'inputs'} side
   * @returns {Map<string,Object>|undefined}
   */
  _getHandleMap = (node, side) => {
    if (!node) return undefined
    const cached = this._handleCache.get(node.id)?.[side]
    const list = node.data?.[side]
    if (cached && cached.list === list) {
      return cached.map
    }
    const map = new Map()
    list?.forEach((io) => map.set(io.id, io))
    const entry = { ...(this._handleCache.get(node.id) || {}), [side]: { list, map } }
    this._handleCache.set(node.id, entry)
    return map
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
    if (sourceNode.parentNode !== targetNode.parentNode && !isHistorying) {
      return false
    }

    const sourceOutput = this._getHandleMap(sourceNode, 'outputs')?.get(sourceHandle)
    const targetInput = this._getHandleMap(targetNode, 'inputs')?.get(targetHandle)

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
    return isTypeConnectable(sourceOutput.type, targetInput.type)
  }

  /**
   * 获取连线样式
   * @param {Object} connection 连线信息
   * @returns {Object} 连线样式
   */
  getConnectionStyle = (connection) => {
    if (['next', 'next-false'].includes(connection.sourceHandle) && connection.targetHandle === 'prev') {
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
    if (Object.prototype.hasOwnProperty.call(connection, 'selectable')) {
      selectable = connection.selectable
    }
    let deletable = true
    if (Object.prototype.hasOwnProperty.call(connection, 'deletable')) {
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
