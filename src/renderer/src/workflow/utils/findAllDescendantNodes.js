/**
 * 递归查找节点的所有后代节点
 * @param {Object} node - 要查找后代的父节点
 * @param {Array} allNodes - 所有节点的数组
 * @returns {Array} - 包含所有后代节点的数组
 */
export const findAllDescendantNodes = (node, allNodes) => {
  // 存储找到的后代节点
  const descendants = new Set()

  // 递归查找后代节点的函数
  function recursiveFind(currentNodeId) {
    // 查找当前节点的直接子节点
    const children = allNodes.filter((child) => child.parentNode === currentNodeId)

    // 将直接子节点添加到后代列表
    children.forEach((child) => {
      descendants.add(child)
    })

    // 对每个子节点递归查找它们的子节点
    children.forEach((child) => {
      recursiveFind(child.id)
    })
  }

  // 从传入的节点开始递归查找
  recursiveFind(node.id)

  return descendants
}
