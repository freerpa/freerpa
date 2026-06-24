/**
 * 获取所有从起始节点出发的后置节点（直接+间接）
 * @param {Array} edges - 所有边的数组（格式：{ id, source, target, ... }）
 * @param {Array} nodes - 所有节点的数组（格式：{ id, ... }）
 * @param {string} startNodeId - 起始节点ID
 * @returns {Array} 所有后置节点的数组（节点对象）
 */
export const getAllSuccessorNodes = (edges, nodes, startNodeId) => {
  // 存储已访问的节点ID（防循环）
  const visited = new Set();
  // 存储所有后置节点ID
  const successorIds = new Set();
  // 队列用于迭代遍历（避免递归栈溢出）
  const queue = [startNodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift(); // 取出当前节点ID

    // 若已访问，跳过（避免重复处理）
    if (visited.has(currentNodeId)) continue;
    visited.add(currentNodeId);

    // 找到所有以当前节点为source的边，获取直接后置节点ID（target）
    const directSuccessorIds = edges
      .filter(edge => edge.source === currentNodeId && ['next', 'next-false'].includes(edge.sourceHandle))
      .map(edge => edge.target);

    // 处理每个直接后置节点
    directSuccessorIds.forEach(successorId => {
      // 若未加入后置集合，添加并加入队列继续遍历
      if (!successorIds.has(successorId)) {
        successorIds.add(successorId);
        queue.push(successorId); // 递归寻找其后续节点
      }
    });
  }

  // 将后置节点ID映射为节点对象
  return nodes.filter(node => successorIds.has(node.id));
};
