//获取有效节点数量
export const getValidNodesCount = (nodes) => {
  return nodes?.filter(
    (node) =>
      !['workflowStart', 'workflowEnd', 'comment', 'workFlow'].includes(node.data.type) && !node.id.includes('subFlow')
  ).length
}
