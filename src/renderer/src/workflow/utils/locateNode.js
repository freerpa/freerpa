//定位节点
export const locateNode = (vueFlowRef, nodeIds) => {
  if (nodeIds.length > 0) {
    vueFlowRef.removeSelectedEdges()
    vueFlowRef.removeSelectedNodes()
    nodeIds.forEach((nodeId) => {
      const nodeEl = vueFlowRef.findNode(nodeId)
      if (nodeEl) {
        nodeEl.selected = true
      }
    })
    vueFlowRef.fitView({
      padding: 0.05,
      includeHiddenNodes: false,
      maxZoom: 1,
      nodes: nodeIds
    })
  }
}
