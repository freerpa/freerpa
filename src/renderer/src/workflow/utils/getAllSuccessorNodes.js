/**
 * 获取所有从起始节点出发的后置节点（直接+间接），仅追踪 next/next-false 流程分支
 * @param {Array} edges - 所有边的数组（格式：{ id, source, target, sourceHandle, ... }）
 * @param {Array} nodes - 所有节点的数组（格式：{ id, ... }）
 * @param {string} startNodeId - 起始节点ID
 * @returns {Array} 所有后置节点的数组（节点对象）
 */
export const getAllSuccessorNodes = (edges, nodes, startNodeId) => {
  // 预构建邻接表：edge.source → target[]（仅 next/next-false），避免 BFS 内每次全量 filter
  const adj = new Map()
  for (const edge of edges) {
    if (!['next', 'next-false'].includes(edge.sourceHandle)) continue
    const list = adj.get(edge.source) || []
    list.push(edge.target)
    adj.set(edge.source, list)
  }

  const successorIds = new Set()
  const visited = new Set()
  // 队列用头指针索引代替 shift()（shift 为 O(n)），BFS 迭代避免递归栈溢出
  const queue = [startNodeId]
  let head = 0
  while (head < queue.length) {
    const currentId = queue[head++]
    // visited 记录已扩展的节点（区分“既是target又待扩展”的中间节点），避免复用 successorIds 时误跳过
    if (visited.has(currentId)) continue
    visited.add(currentId)
    for (const target of adj.get(currentId) || []) {
      if (!successorIds.has(target)) {
        successorIds.add(target)
        queue.push(target)
      }
    }
  }

  return nodes.filter((node) => successorIds.has(node.id))
}