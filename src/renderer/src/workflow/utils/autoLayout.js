import { nextTick } from 'vue'
import { adjustParentSize } from './adjustParentSize'
import { useFlowStore } from '../store'

export const autoLayout = (vueFlowRef) => {
  const { saveHistory } = useFlowStore(vueFlowRef.id)
  const layoutedIds = new Set()

  const layout = (allNodes, allEdges, layoutNodes, x, y, gapX = 50, gapY = 30) => {
    // 递归终止条件：没有待布局节点
    if (layoutNodes.length === 0) return 0
    // 预处理：边映射（source -> Set<target>），优化后继查找效率
    const edgeMap = allEdges.sort((a, b) => {
      const priorityMap = {
        'next': 1,
        'next-false': 2,
      }
      // 获取优先级（无匹配则用默认权重99）
      const aPriority = priorityMap[a.sourceHandle] || 99;
      const bPriority = priorityMap[b.sourceHandle] || 99;
      // 升序排列（权重小的在前）
      return aPriority - bPriority;
    }).reduce((map, edge) => {
      const { source, target } = edge;
      if (!map.has(source)) map.set(source, new Set());
      map.get(source).add(target);
      return map;
    }, new Map());
    // 定义当前盒子的高度
    let boxHeight = 0
    // 遍历所有待布局节点
    for (const currentNode of layoutNodes) {
      // 加入已布局节点集合
      layoutedIds.add(currentNode.id)
    }
    for (const currentNode of layoutNodes) {
      // 如果当前X位置为null，说明是第一个节点，继承当前节点的X位置
      if (x === null) x = currentNode.position.x
      // 如果当前Y位置为null，说明是第一个节点，继承当前节点的Y位置
      if (y === null) y = currentNode.position.y
      // 设置当前节点的位置
      currentNode.position = {
        x,
        y
      }
      // 获取当前当前节点的所有后继节点
      const successorIds = edgeMap.get(currentNode.id) || new Set();
      const successors = [...successorIds].filter(id => !layoutedIds.has(id)).map(id => allNodes.find(node => node.id === id))
      // 递归布局后继节点，获取其盒子高度
      const successorBoxHeight = layout(allNodes, allEdges, successors, currentNode.position.x + currentNode.dimensions.width + gapX, currentNode.position.y, gapX, gapY)
      let currentNodeHeight = currentNode.dimensions.height
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
  const topNodeIds = topNodes.map((node) => node.id)
  const topEdges = edges.filter(
    (edge) => topNodeIds.includes(edge.source) && topNodeIds.includes(edge.target)
  )
  const topStartNodes = topNodes.filter((node) => !topEdges.some((edge) => edge.target === node.id))
  layout(topNodes, topEdges, topStartNodes, null, null)
  // 布局子流程节点
  const subFlowContainerIds = nodes
    .filter((node) => node.id.includes('-subFlow'))
    .map((node) => node.id)
  subFlowContainerIds.forEach((nodeId) => {
    const subFlowNodes = nodes.filter((node) => node.parentNode === nodeId)
    const subFlowNodeIds = subFlowNodes.map((node) => node.id)
    const subFlowEdges = edges.filter(
      (edge) => subFlowNodeIds.includes(edge.source) && subFlowNodeIds.includes(edge.target)
    )
    const subFlowStartNodes = subFlowNodes.filter((node) => !subFlowEdges.some((edge) => edge.target === node.id))
    layout(subFlowNodes, subFlowEdges, subFlowStartNodes, null, null)
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
