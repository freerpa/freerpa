// 获取节点在画布中的坐标
export const getFlowCoordinate = (node, vueFlowRef) => {
  let position = { ...node.position }
  if (node.parentNode) {
    const parentPosition = getFlowCoordinate(vueFlowRef.getNode(node.parentNode), vueFlowRef)
    position.x = position.x + parentPosition.x
    position.y = position.y + parentPosition.y
  }
  return position
}

// 获取相对坐标
export const getRelativeCoordinate = (parentNodeId, position, vueFlowRef) => {
  if (!parentNodeId) {
    return position
  }
  const parentPosition = getFlowCoordinate(vueFlowRef.getNode(parentNodeId), vueFlowRef)
  return {
    x: position.x - parentPosition.x,
    y: position.y - parentPosition.y
  }
}
