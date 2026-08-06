import { v4 as uuidv4 } from 'uuid'
import { Message } from '@arco-design/web-vue'
import nodes from '@nodes-path'
import {
  getInitNodeData,
  getNodeName,
  locateNode,
  decryptedData,
  rebuildElementIds,
  handleNodeCopy,
  handleNodePaste,
  adjustParentSize
} from '../utils/index.js'

/**
 * 节点增删改查与剪贴板操作——从 FlowCanvas 提取（节点 CRUD ~185 行）
 * @param {Object} deps
 * @param {Object} deps.vueFlowRef vue-flow 实例 ref
 * @param {Object} deps.isExecuting 执行中标记（ref）
 * @param {Object} deps.clipboard 剪贴板 store ref
 * @param {Function} deps.createConnection 连线创建（ConnectionRules 实例方法）
 */
export function useNodeCrud({ vueFlowRef, isExecuting, clipboard, createConnection }) {
  const { workflow: workflowAPI } = window.electronAPI
  const addStartNode = (parentNode) => {
    let startNodeData = getInitNodeData('workflowStart')
    if (startNodeData) {
      startNodeData = JSON.parse(startNodeData)
    }
    // startNodeData.selectable = false
    startNodeData.deletable = false
    startNodeData.focusable = false
    startNodeData.extent = 'parent'
    startNodeData.parentNode = parentNode
    addNode(startNodeData, {
      x: 180,
      y: 60
    })
  }

  // 判断节点数量限制（节点数量不再限制）
  const isOverNodeLimit = (_addNodeCount = 1) => false

  // 添加节点
  const addNode = async (nodeData, position) => {
    if (isExecuting.value) {
      Message.warning('当前工作流正在执行,不允许添加节点')
      return
    }

    // 如果节点是结束节点,则需要查重
    if (nodeData.type === 'workflowEnd') {
      const endNode = vueFlowRef.value.getNodes
        .filter((node) => node.parentNode === nodeData.parentNode)
        .find((node) => node.data.type === 'workflowEnd')
      if (endNode) {
        locateNode(vueFlowRef.value, [endNode.id])
        Message.error('当前流程已存在结束节点,禁止重复添加')
        return
      }
    }

    let workflow = null
    if (nodeData.workflow) {
      const localWf = await workflowAPI.getWorkflow(nodeData.workflow.id)
      if (localWf) {
        let graph = {}
        try { graph = typeof localWf.graph === 'string' ? JSON.parse(localWf.graph) : (localWf.graph || {}) } catch (e) {}
        workflow = {
          id: localWf.id,
          name: localWf.name,
          description: localWf.description,
          cover: '',
          only_node: false,
          elements: typeof localWf.graph === 'string' ? localWf.graph : JSON.stringify(localWf.graph || {}),
          nodes_count: (graph.nodes || []).length
        }
      }
    }

    const nodes_count = workflow ? workflow.nodes_count : 0
    if (isOverNodeLimit(nodes_count)) {
      return
    }
    const newNode = {
      id: `node-${uuidv4()}`,
      type: 'custom',
      position: {
        x: position.x - 150,
        y: position.y
      },
      parentNode: nodeData.parentNode,
      selectable: nodeData.selectable,
      deletable: nodeData.deletable,
      focusable: nodeData.focusable,
      extent: nodeData.extent,
      // expandParent: !!nodeData.parentNode,
      // extent: { range: 'parent', padding: [20, 20, 20, 20] },
      data: {
        user_id: nodeData.user_id || '',
        type: nodeData.type,
        name: getNodeName(
          vueFlowRef.value.getNodes.filter((n) => n.parentNode === nodeData.parentNode),
          workflow ? workflow.name : nodeData.name
        ),
        icon: workflow?.cover,
        description: workflow?.description,
        inputs: nodeData.inputs,
        outputs: nodeData.outputs,
        config: nodeData.config || {}, // 初始化空配置
        status: 'pending', // 初始状态
        view: nodeData.view,
        version: nodeData.version || 'V1'
      },
      focusable: true
    }
    if (workflow) {
      newNode.data.workFlow = {
        id: workflow.id,
        only_node: workflow.only_node,
        store: nodeData.workflow.isStore
      }
    }
    vueFlowRef.value.addNodes([newNode])
    if (nodeData.subFlow) {
      addSubFlowNode(newNode, workflow)
    }
    return newNode
  }

  // 添加子流程节点
  const addSubFlowNode = async (node, workFlow) => {
    const subFlowNode = {
      id: node.id + '-subFlow',
      type: 'subFlow',
      parentNode: node.id,
      hidden: node.data.type === 'workFlow',
      deletable: false,
      position: {
        x: -30,
        y: 150
      },
      data: {
        user_id: node.user_id || '',
        type: node.data.type, // 业务 type 与父节点一致（workFlow / workflowSubWorkflow），避免 getFlowData 收集到注册表不存在的 'subFlow'
        name: nodes[node.data.type]?.subFlow?.name || '工作流',
        inputs: [],
        outputs: [],
        config: {}, // 初始化空配置
        status: 'pending', // 初始状态
        view: false
      }
    }
    let elements = null
    // 如果子流程有工作流，则获取工作流节点并预计算子流程的宽度
    if (workFlow) {
      let elementsData = workFlow.elements
      // 本地工作流：elements 已是纯 JSON，远程工作流需要解密
      if (typeof elementsData === 'string') {
        try {
          // 先尝试直接解析（本地模式）
          elements = JSON.parse(elementsData)
        } catch (e) {
          // 解密后再解析（远程模式）
          const decryptedElements = await decryptedData(elementsData)
          elements = JSON.parse(decryptedElements)
        }
      } else if (typeof elementsData === 'object') {
        elements = elementsData
      }
      // 预计算子流程的宽度
      let minX = Infinity
      let maxX = -Infinity
      elements.nodes
        .filter((node) => !node.parentNode)
        .forEach((node) => {
          minX = Math.min(minX, node.position.x)
          maxX = Math.max(maxX, node.position.x)
        })
      subFlowNode.position.x = -((maxX - minX) / 2) - 30
    }

    // 延迟10毫秒等待高度渲染完成
    setTimeout(() => {
      // 获取父节点尺寸
      const dimensions = vueFlowRef.value.getNode(node.id).dimensions
      // 更新子流程容器节点位置为父节点高度加上原始位置避免节点覆盖
      vueFlowRef.value.updateNode(subFlowNode.id, (node) => {
        return {
          position: {
            x: node.position.x,
            y: node.position.y + dimensions.height
          }
        }
      })
    }, 10)

    // 添加子流程容器节点
    vueFlowRef.value.addNodes([subFlowNode])
    // 添加子流程容器连线
    vueFlowRef.value.addEdges([
      createConnection({
        source: node.id,
        target: subFlowNode.id,
        sourceHandle: 'subFlow',
        targetHandle: 'subFlow',
        selectable: false,
        deletable: false,
        label: nodes[node.data.type]?.subFlow?.name || ''
      })
    ])

    // 如果子流程有工作流，则添加工作流节点
    if (elements && elements?.nodes?.length > 0) {
      elements.nodes.map((node) => {
        node.hidden = true
        if (!node.parentNode) {
          node.parentNode = subFlowNode.id
        }
        return node
      })
      // 重建元素ID
      elements = rebuildElementIds(vueFlowRef.value, elements)
      vueFlowRef.value.addNodes(elements.nodes)
      vueFlowRef.value.addEdges(elements.edges)
    } else {
      // 如果子流程没有工作流，则添加一个起始节点
      addStartNode(subFlowNode.id)
    }
  }

  // 处理节点操作（工具栏：删除 / 复制）
  const handleNodeAction = (action, nodeId) => {
    const node = vueFlowRef.value.getNode(nodeId)
    if (action === 'delete') {
      handleNodeDelete(node)
    } else if (action === 'copy') {
      handleNodeCopy(vueFlowRef.value, clipboard, [node])
      handleNodePaste(vueFlowRef.value, clipboard.value, isOverNodeLimit)
      clipboard.value = null
    }
  }

  // 处理节点删除
  const handleNodeDelete = (elements) => {
    if (isExecuting.value) {
      Message.warning('当前工作流正在执行,不允许删除节点')
      return
    }
    // 支持单个ID或ID数组
    const elementsToDelete = Array.isArray(elements) ? elements : [elements]
    const nodeIds = []
    const edgeIds = []
    // 收集被删节点所属容器：删除后容器需收缩/剩余子节点重排（store onNodesChange 过滤 remove 事件，此路径需主动触发）
    const affectedParents = new Set()
    elementsToDelete.forEach((el) => {
      if (el.id.startsWith('node-')) {
        // 开始节点不允许删除,清空配置
        if (el.data.type === 'workflowStart') {
          el.data.config = {}
          // 起始节点保留但取消选中：全选删除后不应残留选中状态（避免配置抽屉弹开）
          el.selected = false
        } else {
          nodeIds.push(el.id)
          if (el.parentNode?.includes('subFlow')) {
            affectedParents.add(el.parentNode)
          }
        }
      } else if (el.id.startsWith('edge-')) {
        edgeIds.push(el.id)
      }
    })
    nodeIds && vueFlowRef.value.removeNodes(nodeIds, true, true)
    edgeIds && vueFlowRef.value.removeEdges(edgeIds)
    // 删除后主动重算容器尺寸（空容器收缩 / 剩余子节点重排）
    if (affectedParents.size > 0) {
      adjustParentSize([...affectedParents].map((id) => ({ id })), vueFlowRef.value)
    }
  }

  return {
    addStartNode,
    addNode,
    addSubFlowNode,
    handleNodeAction,
    handleNodeDelete,
    isOverNodeLimit
  }
}
