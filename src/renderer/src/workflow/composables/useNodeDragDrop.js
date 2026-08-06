import { ref, nextTick } from 'vue'
import {
  getFlowCoordinate,
  getRelativeCoordinate,
  getNodeName,
  autoConnect,
  getAllSuccessorNodes,
  adjustParentSize
} from '../utils/index.js'

/**
 * 节点拖拽归属与快速连接——从 FlowCanvas 提取（拖拽/插边/快速连接 ~235 行）
 * @param {Object} deps
 * @param {Object} deps.vueFlowRef vue-flow 实例 ref
 * @param {Object} deps.isCtrl Ctrl 键状态 ref
 * @param {Object} deps.isDragging 拖拽标记 ref
 * @param {Object} deps.IntersectingNode 交叉节点 ref
 * @param {Object} deps.isExecuting 执行中标记 ref
 * @param {Function} deps.addNode 节点添加（useNodeCrud）
 * @param {Function} deps.createConnection 连线创建
 */
export function useNodeDragDrop({ vueFlowRef, isCtrl, isDragging, IntersectingNode, isExecuting, addNode, createConnection }) {
  // 处理节点拖拽（Ctrl 穿透子流程的交叉检测）
  const onNodeDrag = (data) => {
    if (!isCtrl.value) return

    const position = vueFlowRef.value.screenToFlowCoordinate({
      x: data.event.clientX,
      y: data.event.clientY
    })
    const subFlowNodes = vueFlowRef.value.getNodes.filter(
      (node) => node.type === 'subFlow' && !node.hidden
    )
    if (subFlowNodes.length === 0) return
    // 获取当前节点与子流程节点的交集
    IntersectingNode.value = vueFlowRef.value
      .getIntersectingNodes(
        {
          x: position.x,
          y: position.y,
          width: 1,
          height: 1
        },
        false,
        subFlowNodes
      )
      .pop()
  }

  // 处理节点拖拽停止（拖放归属调整、越界边清理、容器尺寸重算）
  const onNodeDragStop = (data) => {
    isDragging.value = false
    if (!isCtrl.value) return
    let parentPosition = null
    let parentNode = undefined
    if (IntersectingNode.value) {
      parentPosition = getFlowCoordinate(IntersectingNode.value, vueFlowRef.value)
      parentNode = IntersectingNode.value.id
    }
    const oldParentNode = []
    data.nodes
      .filter(
        (node) =>
          !['comment', 'subFlow'].includes(node.type) &&
          node.data.type !== 'workflowStart' &&
          node.data.type !== 'workflowEnd' &&
          node.parentNode !== parentNode
      )
      .forEach((node) => {
        const position = getFlowCoordinate(node, vueFlowRef.value)
        if (parentPosition) {
          position.x = position.x - parentPosition.x
          position.y = position.y - parentPosition.y
        }
        node.parentNode && oldParentNode.push(node.parentNode)
        vueFlowRef.value.updateNode(node.id, (node) => {
          //同级名称查重
          node.data.name = getNodeName(
            vueFlowRef.value.getNodes.filter((n) => n.parentNode === parentNode && n.id !== node.id),
            node.data.name
          )
          node.parentNode = parentNode
          node.position = position
        })
      })
    //获取所有和交叉节点关联的边
    const edges = vueFlowRef.value.getEdges.filter(
      (edge) => edge.sourceNode.parentNode === parentNode || edge.targetNode.parentNode === parentNode
    )
    const childNodeIds = vueFlowRef.value.getNodes
      .filter((node) => (parentNode ? node.parentNode === parentNode : !node.parentNode))
      .map((node) => node.id)

    IntersectingNode.value = null
    //如果边不在当前节点中,则删除
    edges.forEach((edge) => {
      if (!childNodeIds.includes(edge.source) || !childNodeIds.includes(edge.target)) {
        vueFlowRef.value.removeEdges([edge.id])
      }
    })
    if (oldParentNode.length > 0) {
      oldParentNode.forEach((parentNode) => {
        const childNode = vueFlowRef.value.getNodes.find((node) => node.parentNode === parentNode)
        if (childNode) {
          adjustParentSize([childNode], vueFlowRef.value)
        }
      })
    }
    // 同步重算容器尺寸（拖拽停止即时反馈；store 的 rAF 路径会再触发一次，但 adjustParentSize 有尺寸未变不 updateNode 的幂等检测，二次执行无副作用）
    adjustParentSize(data.nodes, vueFlowRef.value)
  }

  // 处理节点拖放
  const onDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  // 添加节点到子流程
  const addNodeToSubFlow = async ({ nodeData, fromNode, position }) => {
    nodeData = JSON.parse(nodeData)
    fromNode = vueFlowRef.value.getNode(fromNode)
    nodeData.parentNode = fromNode.id
    const parentPosition = getFlowCoordinate(fromNode, vueFlowRef.value)
    const realPosition = {
      x: position.x - parentPosition.x,
      y: position.y - parentPosition.y
    }
    addNode(nodeData, realPosition)
  }

  // 从边添加节点（后继节点让位）
  const addNodeFromEdge = async ({ fromEdge, nodeData }) => {
    nodeData = JSON.parse(nodeData)
    const edge = vueFlowRef.value.findEdge(fromEdge)
    const sourceNode = edge.sourceNode
    const targetNode = edge.targetNode
    let position = {
      x: sourceNode.position.x + sourceNode.dimensions.width + 200,
      y: targetNode.position.y
    }
    if (sourceNode.position.x > targetNode.position.x) {
      // 添加新节点
      position = {
        x: sourceNode.position.x + sourceNode.dimensions.width + 200,
        y: sourceNode.position.y
      }
    }
    nodeData.parentNode = sourceNode.parentNode
    const newNode = await addNode(nodeData, position)
    // 删除原来的边
    vueFlowRef.value.removeEdges(fromEdge)
    await nextTick()
    autoConnect(vueFlowRef.value, createConnection, sourceNode, newNode, edge.sourceHandle)
    autoConnect(vueFlowRef.value, createConnection, newNode, targetNode)
    await nextTick()
    if (newNode) {
      if (sourceNode.position.x < targetNode.position.x) {
        const nextNodes = getAllSuccessorNodes(
          vueFlowRef.value.getEdges,
          vueFlowRef.value.getNodes.filter((node) => node.parentNode === sourceNode.parentNode),
          targetNode.id
        )
        // 更新节点位置为新节点让出位置
        vueFlowRef.value.updateNodePositions(
          [
            {
              id: targetNode.id,
              position: {
                x: targetNode.position.x + 350,
                y: targetNode.position.y
              }
            },
            ...nextNodes
              .filter((node) => node.position.x > sourceNode.position.x)
              .map((node) => ({
                id: node.id,
                position: {
                  x: node.position.x + 350,
                  y: node.position.y
                }
              }))
          ],
          true
        )
      }
    }
  }

  // 节点列表弹窗
  const nodeListVisible = ref(false)
  // 快速连接样式
  const quickConnectStyle = ref({
    position: 'fixed',
    top: '0',
    right: '0'
  })
  // 快速连接节点ID
  const quickConnect = ref(null)

  // 显示快速连接
  const showQuickConnect = ({ e, edgeId, handleId, nodeId, position }) => {
    if (isExecuting.value) {
      return
    }
    nodeListVisible.value = true
    quickConnect.value = {
      edgeId,
      handleId,
      nodeId,
      position
    }
    quickConnectStyle.value = {
      position: 'fixed',
      top: `${e.clientY}px`,
      left: `${e.clientX}px`
    }
  }

  // 快速连接节点
  const quickConnectChooseNode = (nodeData) => {
    if (!quickConnect.value.edgeId) {
      addNodeFromNode({
        fromNode: quickConnect.value.nodeId,
        nodeData,
        handleId: quickConnect.value.handleId,
        position: quickConnect.value.position
      })
    } else {
      addNodeFromEdge({
        fromEdge: quickConnect.value.edgeId,
        nodeData
      })
    }
    nodeListVisible.value = false
  }

  // 从节点添加节点
  const addNodeFromNode = async ({ nodeData, fromNode, handleId, position }) => {
    nodeData = JSON.parse(nodeData)
    fromNode = vueFlowRef.value.getNode(fromNode)
    nodeData.parentNode = fromNode.parentNode
    let newPosition = {}
    if (position) {
      newPosition = getRelativeCoordinate(fromNode.parentNode, position, vueFlowRef.value)
    } else {
      newPosition = {
        x: fromNode.position.x + fromNode.dimensions.width / 2 + fromNode.dimensions.width + 50,
        y: fromNode.position.y
      }
    }
    if (handleId == 'next-false') {
      newPosition.y = newPosition.y + 45
    }
    const newNode = await addNode(nodeData, newPosition)
    if (newNode) {
      await nextTick()
      autoConnect(vueFlowRef.value, createConnection, fromNode, newNode, handleId)
    }
  }

  return {
    onNodeDrag,
    onNodeDragStop,
    onDragOver,
    addNodeToSubFlow,
    addNodeFromEdge,
    addNodeFromNode,
    nodeListVisible,
    quickConnectStyle,
    quickConnect,
    showQuickConnect,
    quickConnectChooseNode
  }
}
