/**
 * 递归查找节点的所有后代节点（parentNode 层级）
 * @param {Object} node - 要查找后代的父节点
 * @param {Array} allNodes - 所有节点的数组
 * @returns {Set} - 包含所有后代节点的 Set
 */
export const findAllDescendantNodes = (node, allNodes) => {
  // 预构建 parentNode → children 邻接，避免递归内每次全量 filter（O(n²) → O(n)）
  const childrenMap = allNodes.reduce((map, n) => {
    if (n.parentNode) {
      const list = map.get(n.parentNode) || []
      list.push(n)
      map.set(n.parentNode, list)
    }
    return map
  }, new Map())

  const descendants = new Set()
  const stack = [node.id]
  while (stack.length > 0) {
    const currentNodeId = stack.pop()
    const children = childrenMap.get(currentNodeId)
    if (!children) continue
    for (const child of children) {
      if (descendants.has(child)) continue
      descendants.add(child)
      stack.push(child.id)
    }
  }
  return descendants
}