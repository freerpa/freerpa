import { v4 as uuidv4 } from 'uuid'
import { getNodeName } from './index'
export const getNodeGroupBySubFlow = (nodes) => {
  //根据parentNode分组（根级节点为'root'）
  return nodes.reduce((groups, node) => {
    const parent = node.parentNode || 'root'
    if (!groups[parent]) {
      groups[parent] = []
    }
    groups[parent].push(node)
    return groups
  }, {})
}
//重建所有的元素ID
export const rebuildElementIds = (vueFlowRef, elements) => {
  let elementsString = JSON.stringify(elements)
  let newElements = JSON.parse(elementsString)
  // 替换节点、边ID
  const newNodeIds = new Map()
  newElements.nodes
    .filter((node) => !node.id.includes('subFlow'))
    .forEach((node) => {
      newNodeIds.set(node.id, `node-${uuidv4()}`)
    })

  const newEdgeIds = new Map()
  newElements.edges.forEach((edge) => {
    const newEdgeId = `edge-${uuidv4()}`
    newEdgeIds.set(edge.id, newEdgeId)
  })

  //生成新元素字符串（替换节点名称后的）
  elementsString = JSON.stringify(newElements)

  //替换节点ID
  newNodeIds.forEach((newNodeId, oldNodeId) => {
    elementsString = elementsString.replaceAll(oldNodeId, newNodeId)
  })

  //替换边ID
  newEdgeIds.forEach((newEdgeId, oldEdgeId) => {
    elementsString = elementsString.replaceAll(oldEdgeId, newEdgeId)
  })

  //生成新元素对象
  newElements = JSON.parse(elementsString)

  //遍历所有节点，如果parentNode在画布中找不到就提升为根级节点
  newElements.nodes.forEach((node) => {
    if (![...vueFlowRef.getNodes, ...newElements.nodes].find((n) => n.id === node.parentNode)) {
      delete node.parentNode
    }
  })
  const NodeGroupBySubFlow = getNodeGroupBySubFlow(newElements.nodes)
  //对子流程节点名称查重（防止重名）
  Object.keys(NodeGroupBySubFlow).forEach((parent) => {
    const nodes = NodeGroupBySubFlow[parent]
    const newNodeNames = new Map()
    const newNodes = []
    //获取同级节点
    const equativeNodes = vueFlowRef.getNodes.filter(
      (n) => n.parentNode === (parent === 'root' ? undefined : parent)
    )
    nodes
      .filter((node) => !node.id.includes('subFlow'))
      .forEach((node) => {
        const newNodeName = getNodeName([...equativeNodes, ...newNodes], node.data.name)
        newNodeNames.set(node.data.name, newNodeName)
        node.data.name = newNodeName
        newNodes.push(node)
      })

    //替换节点变量引用
    const keys = Array.from(newNodeNames.keys()).reverse()
    keys.forEach((oldNodeName) => {
      elementsString = elementsString.replaceAll(
        '{{' + oldNodeName + '.',
        '{{' + newNodeNames.get(oldNodeName) + '.'
      )
    })
  })

  return newElements
}
