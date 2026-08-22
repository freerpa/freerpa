import { nextTick } from 'vue'
import { adjustParentSize } from './adjustParentSize'
import { useFlowStore } from '../store'

// 边优先级（next/next-false 靠前）
const edgePriority = { 'next': 1, 'next-false': 2 }

/** 构建排序后的 source → target[] 邻接表（局部副本排序，避免污染原始边数组） */
const buildEdgeMap = (edgeList) => {
  const map = new Map()
  edgeList
    .slice()
    .sort((a, b) => (edgePriority[a.sourceHandle] || 99) - (edgePriority[b.sourceHandle] || 99))
    .forEach((edge) => {
      const list = map.get(edge.source) || []
      list.push(edge.target)
      map.set(edge.source, list)
    })
  return map
}

export const autoLayout = (vueFlowRef) => {
  const { saveHistory } = useFlowStore(vueFlowRef.id)
  const layoutedIds = new Set()

  // 预建全图 id → node 映射，供递归中的后继查找（替代每次全量 find O(n)）
  const allNodesById = new Map(
    vueFlowRef.getNodes
      .filter((node) => node.type !== 'comment' && !node.hidden)
      .map((n) => [n.id, n])
  )

  // edgeMap 为该组的邻接表（由调用方预建一次，递归时原样传递，避免每次递归重排序）
  const layout = (edgeMap, layoutNodes, x, y, gapX = 50, gapY = 30) => {
    // 递归终止条件：没有待布局节点
    if (layoutNodes.length === 0) return 0
    // 定义当前盒子的高度
    let boxHeight = 0
    // 标记本次待布局节点为已布局（去重）
    for (const currentNode of layoutNodes) {
      layoutedIds.add(currentNode.id)
    }
    for (const currentNode of layoutNodes) {
      // 如果当前X位置为null，说明是第一个节点，继承当前节点的X位置
      if (x === null) x = currentNode.position.x
      // 如果当前Y位置为null，说明是第一个节点，继承当前节点的Y位置
      if (y === null) y = currentNode.position.y
      // 设置当前节点的位置
      currentNode.position = { x, y }
      // 获取当前当前节点的所有后继节点
      const nextNodes = (edgeMap.get(currentNode.id) || [])
        .filter((id) => !layoutedIds.has(id))
        .map((id) => allNodesById.get(id))
        .filter(Boolean) // 防损坏连线/历史遗留的悬空目标节点（undefined 会递归崩溃）
      // 递归布局后继节点，获取其盒子高度
      const successorBoxHeight = layout(
        edgeMap,
        nextNodes,
        currentNode.position.x + (currentNode.dimensions?.width || 200) + gapX,
        currentNode.position.y,
        gapX,
        gapY
      )
      let currentNodeHeight = currentNode.dimensions?.height || 100
      // 如果当前节点是父节点，高度增加50（用于容纳子节点展开按钮）
      if (currentNode.isParent) {
        currentNodeHeight += 50
      }
      // 计算当前节点和后继节点中较高的那个
      const maxHeight = Math.max(currentNodeHeight, successorBoxHeight)
      // 更新当前盒子高度为当前节点和后继节点中较高的那个
      boxHeight += maxHeight + gapY
      // 更新下一个节点的Y位置
      y += maxHeight + gapY
    }
    // 返回当前盒子的高度(减去最后一个节点的间距)
    return boxHeight - gapY
  }

  const nodes = vueFlowRef.getNodes.filter((node) => node.type !== 'comment' && !node.hidden)
  const edges = vueFlowRef.getEdges.filter(
    (edge) => edge.targetHandle === 'prev' && ['next', 'next-false'].includes(edge.sourceHandle)
  )

  // 布局顶级节点
  const topNodes = nodes.filter((node) => !node.parentNode)
  const topNodeIds = new Set(topNodes.map((node) => node.id))
  const topEdges = edges.filter(
    (edge) => topNodeIds.has(edge.source) && topNodeIds.has(edge.target)
  )
  const topStartNodes = topNodes.filter((node) => !topEdges.some((edge) => edge.target === node.id))
  layout(buildEdgeMap(topEdges), topStartNodes, null, null)

  // 布局子流程节点
  const subFlowContainerIds = nodes
    .filter((node) => node.id.includes('-subFlow'))
    .map((node) => node.id)
  subFlowContainerIds.forEach((nodeId) => {
    const subFlowNodes = nodes.filter((node) => node.parentNode === nodeId)
    const subFlowNodeIds = new Set(subFlowNodes.map((node) => node.id))
    const subFlowEdges = edges.filter(
      (edge) => subFlowNodeIds.has(edge.source) && subFlowNodeIds.has(edge.target)
    )
    const subFlowStartNodes = subFlowNodes.filter(
      (node) => !subFlowEdges.some((edge) => edge.target === node.id)
    )
    layout(buildEdgeMap(subFlowEdges), subFlowStartNodes, null, null)
  })

  // 保存布局
  saveHistory()
  nextTick(() => {
    setTimeout(() => {
      vueFlowRef.fitView({
        padding: 0.05,
        includeHiddenNodes: false,
        maxZoom: 1
      })
      // 调整父节点大小
      adjustParentSize(vueFlowRef.getNodes, vueFlowRef)
    }, 100)
  })
}