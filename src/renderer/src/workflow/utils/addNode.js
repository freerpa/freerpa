
import { getNodeName } from './index'
// 添加节点
export const addNode = async (nodeData, position, vueFlowRef) => {
  if (nodeData.type === 'subFlow') {
    return
  }
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
    const localWf = await window.electronAPI.workflow.getWorkflow(nodeData.workflow.id)
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
      view: nodeData.view
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