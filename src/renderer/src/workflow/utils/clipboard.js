import { Message } from '@arco-design/web-vue'
import {
  findAllDescendantNodes,
  rebuildElementIds,
  getValidNodesCount,
  calculateBoundingBox
} from './index'
// 处理节点复制
export const handleNodeCopy = (vueFlowRef, clipboard, selectedNodes) => {
  let activeNodes = vueFlowRef.getSelectedNodes
  let activeEdges = []
  if (selectedNodes) {
    activeNodes = selectedNodes
  }

  //去除结束节点
  // activeNodes = activeNodes.filter((node) => node.data.type !== 'endNode')

  //查找所有子孙节点
  activeNodes.forEach((node) => {
    const allChildNodes = findAllDescendantNodes(node, vueFlowRef.getNodes)
    activeNodes.push(...allChildNodes)
  })

  //去除重复节点
  activeNodes = activeNodes.filter(
    (node, index, self) => index === self.findIndex((t) => t.id === node.id)
  )

  const activeNodeIds = activeNodes.map((node) => node.id)
  //查找所有边
  vueFlowRef.getEdges.forEach((edge) => {
    //判断当前边是否前后都在activeNodes中
    if (activeNodeIds.includes(edge.source) && activeNodeIds.includes(edge.target)) {
      activeEdges.push(edge)
    }
  })

  if (activeNodes.length > 0) {
    clipboard.value = {
      nodes: JSON.parse(JSON.stringify(activeNodes)),
      edges: JSON.parse(JSON.stringify(activeEdges)),
      source: {
        flowId: vueFlowRef.id,
        viewport: vueFlowRef.viewport
      },
      target: {
        flowId: vueFlowRef.id,
        viewport: vueFlowRef.viewport
      }
    }
    // Message.success('节点复制成功')
  }
}

// 处理节点粘贴
export const handleNodePaste = (vueFlowRef, clipboard, isOverNodeLimit) => {
  if (clipboard) {
    //查找顶级节点（没有父节点或者父节点不在clipboard.nodes中）
    const topNodes = clipboard.nodes.filter((node) => !node.parentNode || !clipboard.nodes.some((n) => n.id === node.parentNode))
    //判断是否跨工作流或者跨viewport粘贴,计算新位置粘贴到画布中心
    if ((clipboard.source.flowId !== vueFlowRef.id || clipboard.source.viewport !== vueFlowRef.viewport) && (clipboard.target.flowId !== vueFlowRef.id || clipboard.target.viewport !== vueFlowRef.viewport)) {
      //获取屏幕中心点
      const screenCenter = {
        x: window.innerWidth / 2,
        y: (window.innerHeight - 40) / 2
      }
      // 转换为工作流坐标
      const { x: centerX, y: centerY } = vueFlowRef.screenToFlowCoordinate(screenCenter)
      //计算新位置粘贴到画布中心(保持源节点相对位置)
      const boundingBox = calculateBoundingBox(topNodes)
      const offsetX = centerX - (boundingBox.x + boundingBox.width / 2)
      const offsetY = centerY - (boundingBox.y + boundingBox.height / 2)
      topNodes.forEach((node) => {
        node.position = {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY
        }
      })
      clipboard.target = {
        flowId: vueFlowRef.id,
        viewport: vueFlowRef.viewport
      }
    } else {
      topNodes.forEach((node) => {
        node.position = {
          x: node.position.x + 20,
          y: node.position.y + 20
        }
      })
    }

    // 粘贴节点
    if (isOverNodeLimit(getValidNodesCount(clipboard.nodes))) {
      Message.warning({
        id: 'workflow-node-limit',
        content: `当前工作流节点数量超过限制`
      })
      return
    }
    //重建元素ID
    const newElements = rebuildElementIds(vueFlowRef, clipboard)
    //去除当前所有的选中
    vueFlowRef.removeSelectedEdges()
    vueFlowRef.removeSelectedNodes()
    const startNodes = []
    const endNodes = []
    const flowNodes = []
    newElements.nodes.forEach((node) => {
      if (node.data.type === 'workflowStart') {
        startNodes.push(node)
      } else if (node.data.type === 'workflowEnd') {
        endNodes.push(node)
      } else {
        flowNodes.push(node)
      }
    })
    //添加开始节点
    startNodes.forEach((node) => {
      const startNode = vueFlowRef.getNodes.find((n) => n.parentNode === node.parentNode && n.data.type === 'workflowStart')
      //判断当前层级是否有其他开始节点
      if (startNode) {
        //只复制配置
        startNode.data.config = node.data.config
        newElements.edges.forEach((edge) => {
          if (edge.source === node.id) {
            edge.source = startNode.id
          }
        })
      } else {
        vueFlowRef.addNodes([node])
      }
    })
    //添加结束节点
    endNodes.forEach((node) => {
      const endNode = vueFlowRef.getNodes.find((n) => n.parentNode === node.parentNode && n.data.type === 'workflowEnd')
      //判断当前层级是否有其他结束节点
      if (endNode) {
        //只复制配置
        endNode.data.config = node.data.config
        newElements.edges.forEach((edge) => {
          if (edge.target === node.id) {
            edge.target = endNode.id
          }
        })
      } else {
        vueFlowRef.addNodes([node])
      }
    })
    //添加常规节点
    vueFlowRef.addNodes(flowNodes)
    //添加边
    vueFlowRef.addEdges(newElements.edges)
    // Message.success('节点粘贴成功')
  }
}
