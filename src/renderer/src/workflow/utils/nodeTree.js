// 构建参数树数据
export const getNodeParamsTreeData = (
  nodes,
  types = ['string', 'number', 'boolean', 'array', 'object']
) => {
  types.push('any')
  const parmsData = []
  nodes.map((node) => {
    const item = {
      id: `${node.id}`,
      name: node.data.name || node.id,
      children: (node.data.outputs || [])
        .map((output) =>
          types.some((type) => output.type.includes(type))
            ? {
              id: `${node.id}.${output.id}`,
              name: `${output.name}`,
              type: output.type,
              fullName: `${node.data.name}.${output.name}`
            }
            : null
        )
        .filter(Boolean)
    }
    if (item.children.length > 0) {
      parmsData.push(item)
    }

  })
  return parmsData
}

export const getLeafPathMap = (nodes) => {
  const tree = getNodeParamsTreeData(nodes)
  const map = new Map()
  function traverse(node, parentPath = '') {
    if (!node) return
    const fullPath = parentPath ? `${parentPath}.${node.name}` : node.name
    // 只保存没有子节点的最终节点
    if (!node.children || node.children.length === 0) {
      map.set(fullPath, node)
    } else {
      // 继续遍历子节点
      ; (node.children || []).forEach((child) => traverse(child, fullPath))
    }
  }
  Array.isArray(tree) ? tree.forEach((node) => traverse(node)) : traverse(tree)
  return map
}
