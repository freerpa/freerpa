import { storeToRefs } from 'pinia'
import { useFlowStore } from '../store'
import { Message } from '@arco-design/web-vue'
import { getLeafPathMap, locateNode, getNodeGroupBySubFlow, getGlobleNodes, paramReferRegex } from '../utils'
import nodes from '@nodes-path'
export class WorkflowEngine {
  constructor(workflowId) {
    this.store = useFlowStore(workflowId)
    this.flowId = workflowId
    this.eventHandlers = new Map()
    this.status = 'idle'
    this.listener = []
  }

  // 事件处理
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event).add(handler)
    return () => this.eventHandlers.get(event)?.delete(handler)
  }

  // 触发事件
  emit(event, ...args) {
    this.eventHandlers.get(event)?.forEach((handler) => handler(...args))
  }

  // 设置工作流状态（状态源：engine.status；store 经 statusChange 事件同步 workflowStatus/isExecuting）
  setStatus(status) {
    this.status = status
    this.emit('statusChange', status)
    if (status === 'stopped' || status === 'error' || status === 'completed') {
      this.emit('beforeStop')
      this.cleanup()
      if (status === 'error') {
        throw new Error('工作流执行失败')
      }
    }
  }

  // 注册工作流状态事件（onFlowEvent 的 stateChange/onNotice 通道）
  registerStatusEvent() {
    // 监听工作流状态
    this.listener.push(
      window.electronAPI.onFlowEvent('stateChange', this.flowId, null, (event, state) => {
        this.setStatus(state.state)
      })
    )
    this.listener.push(
      window.electronAPI.onFlowEvent('onNotice', this.flowId, null, (event, data) => {
        this.store.onNotice(data)
      })
    )
  }

  // 获取未连接的节点
  getUnconnectedNodes(flowData) {
    return flowData.nodes
      .filter(
        (node) =>
          node.type !== 'workflowStart' && !node.id.includes('subFlow') && node.type !== 'comment'
      )
      .filter(
        (node) =>
          !flowData.edges.some((edge) => edge.target === node.id && edge.targetHandle === 'prev')
      )
  }

  //验证节点输入是否连接
  validateNodeInputs({ nodes, edges }) {
    let needConnect = []
    nodes.forEach((node) => {
      if (node.inputs) {
        node.inputs.forEach((input) => {
          if (input.required) {
            const edge = edges.find(
              (edge) => edge.target === node.id && edge.targetHandle === input.id
            )
            if (!edge) {
              needConnect.push({
                nodeId: node.id,
                nodeName: node.name,
                inputId: input.id,
                inputName: input.name
              })
            }
          }
        })
      }
    })
    return needConnect
  }

  //验证节点配置是否正确
  async validateNodeConfig() {
    const nodeRefs = this.store.nodeRefs
    const needValidate = []
    for (const [nodeId, nodeRef] of nodeRefs) {
      if (nodeRef && nodeRef.validate && !this.store.vueFlowRef.getNode(nodeId).data.deactivate) {
        try {

          function formatErrorMessages(errors) {
            const result = {};
            // 遍历原始对象的每个字段
            for (const key in errors) {
              if (Object.prototype.hasOwnProperty.call(errors, key)) {
                // 直接取出 message 赋值给对应 key
                result[key] = errors[key].message;
              }
            }
            return result;
          }
          const res = await nodeRef.validate(true)
          if (res) {
            needValidate.push({
              nodeId,
              errors: formatErrorMessages(res)
            })
          }
        } catch {
          // 节点校验失败：错误已通过 event 上报，此处静默
        }
      }
    }
    return needValidate
  }

  //替换参数引用
  replaceParamRefer(flowData) {
    const paramReferErrors = []
    //按照子流程分组
    const NodeGroupBySubFlow = getNodeGroupBySubFlow(this.store.vueFlowRef.getNodes)
    //出全局节点
    const globalNodes = getGlobleNodes(this.store.vueFlowRef.getNodes)
    //按照子流程分组获取参数路径集合
    const LeafPathMaps = new Map()
    Object.keys(NodeGroupBySubFlow).forEach((parent) => {
      const nodes = NodeGroupBySubFlow[parent]
      // 合并全局参数节点
      nodes.push(...globalNodes)
      LeafPathMaps.set(parent, getLeafPathMap(nodes))
    })
    // 替换配置中的参数路径为节点id
    flowData.nodes.forEach((node) => {
      //特殊处理子流程节点（配置和输入项），同级参数引用规则限制，需要父节点传给子流程开始节点
      if (node.subFlow) {
        const startNode = flowData.nodes.find(
          (n) => n.parentNode === node.id + '-subFlow' && n.type === 'workflowStart'
        )
        node.config = Object.assign(node.config, startNode.config)
        startNode.config = []
      }
      try {
        let nodeConfig = JSON.stringify(node.config)
        nodeConfig = nodeConfig.replace(paramReferRegex, (match) => {
          const paramPath = match.slice(2, -2) // 获取参数路径
          const LeafPathMap = LeafPathMaps.get(node.parentNode || 'root')
          const realPath = LeafPathMap.get(paramPath)
          if (realPath) {
            return '{{' + realPath.id + '}}'
          } else {
            throw new Error(`找不到【${paramPath}】的引用`)
          }
        })
        node.config = JSON.parse(nodeConfig)
      } catch (error) {
        paramReferErrors.push({
          nodeId: node.id,
          nodeName: node.name,
          error: `节点【${node.name}】错误：${error.message}`
        })
      }
    })
    return paramReferErrors
  }

  getFlowData() {
    // 工作流数据
    const flowData = {
      id: this.flowId,
      debug: this.store.debug,
      nodes: this.store.vueFlowRef.getNodes.filter(
        // 排除 comment 与 subFlow 容器节点：容器只作画布分组（子节点经 parentNode 关联），不参与执行
        (node) => node.type !== 'comment' && node.type !== 'subFlow' && !node.data.deactivate
      ).map((node) => ({
        id: node.id,
        name: node.data.name,
        type: node.data.type,
        version: node.data.version || 'V1',
        deactivate: node.data.deactivate,
        parentNode: node.parentNode,
        subFlow: !!nodes[node.data.type]?.subFlow,
        inputs: JSON.parse(JSON.stringify(node.data.inputs || [])),
        outputs: JSON.parse(JSON.stringify(node.data.outputs || [])),
        config: JSON.parse(JSON.stringify(node.data.config || {}))
      })),
      edges: this.store.vueFlowRef.getEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        logic: edge.data.logic || 'and',
        condition: JSON.parse(JSON.stringify(edge.data.condition || [])),
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle
      }))
    }
    return flowData
  }

  // 创建工作流
  async create() {
    const flowData = this.getFlowData()
    // 缺少节点定义检测（本地插件被移除等）：阻止运行并定位第一个缺失节点
    const missingNodes = flowData.nodes.filter((n) => !nodes[n.type])
    if (missingNodes.length > 0) {
      locateNode(this.store.vueFlowRef, [missingNodes[0].id])
      throw new Error(
        `工作流包含 ${missingNodes.length} 个缺少本地插件的节点：${missingNodes
          .map((n) => `【${n.name}】`)
          .join('、')}，请安装对应插件后重新加载工作流`
      )
    }
    const { unConnectedNodes, needConnects } = storeToRefs(this.store)
    unConnectedNodes.value = this.getUnconnectedNodes(flowData)
    // 如果有未连接的节点，抛出错误
    if (unConnectedNodes.value.length > 0) {
      locateNode(
        this.store.vueFlowRef,
        unConnectedNodes.value.map((item) => item.id)
      )
      throw new Error('有未连接的节点')
    }

    // 判断所有节点required输入是否连接
    needConnects.value = []
    needConnects.value = this.validateNodeInputs(flowData)
    // if (needConnects.value.length > 0) {
    //   throw new Error(`节点参数连接错误`)
    //   // throw new Error(
    //   //   `节点${needConnects.value.map((item) => `【${item.nodeName}】的【${item.inputName}】输入未连接`).join(',')}`
    //   // )
    // }
    // 验证节点配置是否为空
    const needValidate = await this.validateNodeConfig()
    if (needValidate.length > 0 || needConnects.value.length > 0) {
      locateNode(this.store.vueFlowRef, [
        ...needConnects.value.map((item) => item.nodeId),
        ...needValidate.map((item) => item.nodeId)
      ])
      throw new Error(`节点配置错误`)
    }
    const paramReferErrors = this.replaceParamRefer(flowData)
    if (paramReferErrors.length > 0) {
      locateNode(this.store.vueFlowRef, [paramReferErrors[0].nodeId])
      throw new Error(paramReferErrors[0].error)
    }
    return await window.electronAPI.emitFlowEvent('createEngine', null, null, flowData)
  }

  // 工作流执行
  async start() {
    try {
      const res = await this.create()
      if (!res.success) {
        throw new Error(res.message)
      }
    } catch (error) {
      Message.error(error.message)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
    this.cleanup()
    this.emit('beforeStart')
    // 注册工作流状态事件
    this.registerStatusEvent()
    // 开始工作流
    await window.electronAPI.emitFlowEvent('startFlow', null, null, this.flowId)
    // 设置工作流状态为运行中
    this.setStatus('running')
    // 返回工作流id
    return this.flowId
  }

  // 停止工作流
  async stop() {
    try {
      // 如果工作流id存在，停止工作流
      if (this.flowId) {
        await window.electronAPI.emitFlowEvent('stopFlow', null, null, this.flowId)
      }
    } finally {
      // 清理工作流
      // this.cleanup()
    }
  }
  // 清理
  async cleanup() {
    this.listener.forEach((listener) => listener())
    this.listener = []
    this.emit('cleanup')
  }
}
