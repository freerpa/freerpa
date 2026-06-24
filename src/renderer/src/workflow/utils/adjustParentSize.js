// 计算子节点区域矩形信息
export const calculateBoundingBox = (childNodes) => {
  if (!childNodes || childNodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  // 计算基本边界
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  childNodes.forEach((node) => {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + node.dimensions.width || 300)
    maxY = Math.max(maxY, node.position.y + node.dimensions.height || 300)
  })

  // 添加内边距
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

// 更新父节点区域
export const adjustParentSize = (nodes, vueFlowRef, padding = [44, 44]) => {
  let nodeIds = nodes.map((node) => node.id)
  if (nodeIds.length === 0) {
    return
  }
  nodeIds = [...new Set(nodeIds)]
  padding[1] += 30
  // 子流程节点集合
  let subFlowNodeIds = nodeIds
    .map((id) => {
      return vueFlowRef.getNode(id)
    })
    .filter(Boolean)
    .filter((node) => node.parentNode && node.parentNode.includes('subFlow'))
    .map((node) => node.parentNode)
  // 去重
  subFlowNodeIds = [...new Set(subFlowNodeIds)]
  // 更新父节点区域
  subFlowNodeIds.forEach((parentNodeId) => {
    const parentNode = vueFlowRef.findNode(parentNodeId)
    const childNodes = vueFlowRef.getNodes.filter((n) => n.parentNode === parentNodeId)
    if (childNodes.length > 0) {
      //计算所有子节点外框的矩形信息
      const boundingBox = calculateBoundingBox(childNodes)
      const offsetX = padding[0] - boundingBox.x
      const offsetY = padding[1] - boundingBox.y
      // 如果子节点包围盒超出父节点包围盒，则调整子节点位置
      if (boundingBox.x !== padding[0] || boundingBox.y !== padding[1]) {
        childNodes.forEach((node) => {
          node.position = {
            x: node.position.x + offsetX,
            y: node.position.y + offsetY
          }
        })
        parentNode.position = {
          x: parentNode.position.x - offsetX,
          y: parentNode.position.y - offsetY
        }
      }
      const targetWidth = boundingBox.width + 2 * padding[0]
      const targetHeight = boundingBox.height + 2 * padding[1] - 30

      // 设置最小尺寸限制（避免过度缩小）
      const minWidth = 100
      const minHeight = 80

      // 计算新的父节点尺寸（取当前与目标的最大值）
      const newWidth = Math.max(targetWidth, minWidth)
      const newHeight = Math.max(targetHeight, minHeight)

      // 如果需要调整，更新父节点
      if (newWidth !== parentNode.dimensions.width || newHeight !== parentNode.dimensions.height) {
        vueFlowRef.updateNode(parentNodeId, (node) => {
          return {
            width: newWidth,
            height: newHeight
          }
        })
      }
    }
  })
}
