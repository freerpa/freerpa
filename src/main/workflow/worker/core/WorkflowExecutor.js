import { EventEmitter } from 'node:events'
import ExecutorManager from './ExecutorManager.js'
import { isParamRefer, getRefer, paramReferRegex } from './paramRefer.js'

class WorkflowExecutor extends EventEmitter {
  constructor(options) {
    super()

    if (!Array.isArray(options.nodes) || !Array.isArray(options.edges)) {
      throw new Error('Invalid workflow data: nodes and edges must be arrays')
    }

    options.nodes.forEach((node) => {
      if (!node.id || !node.type) {
        throw new Error(`Invalid node data: ${JSON.stringify(node)}`)
      }
    })

    this.id = options.id
    this.global = options.global || {
      opendBitBrowser: [],
      opendCdpBrowser: []
    }
    // 本地网络服务默认端口（主进程 init 注入，设置中心可配）：挂 global 供 http-server.js 创建共享服务时监听，
    // 执行器无需感知端口（getHttpServer 返回的 server 对象自带 .port）
    this.global.networkServerPort = options.networkServerPort || 9264
    this.debug = options.debug || false
    this.isSubFlow = options.isSubFlow || false
    this.ioRoots = options.ioRoots || []
    this.pluginRoots = options.pluginRoots || [] // 插件目录（主进程 init 注入，pluginCall 执行器据此定位插件）
    this.subFlows = new Map()
    this.allNodes = options.allNodes
    this.allEdges = options.allEdges
    this.nodes = options.nodes
    this.edges = options.edges

    this._nodeMap = new Map()
    if (this.nodes) {
      this.nodes.forEach((n) => this._nodeMap.set(n.id, n))
    }

    this.executorsManager = new ExecutorManager(this)
    this.state = 'pending'
    this.runningCount = 0 // 运行中（running/retrying）执行器计数：归零后延迟复核即全部完成，替代 250ms 轮询
    this.completeTimer = null // 完成判定复核计时器（计数归零后延迟一窗口，等待 next() 启动的后续节点）
    this.startInputs = options.startInputs || {}
    this.nodeOutputs = options.nodeOutputs || {}
    this.nodeExecuteTime = {}
    this.nodeErrorCount = {}

    this._boundHandleNodeStateChange = this.handleNodeStateChange.bind(this)
  }

  _findNode(nodeId) {
    return this._nodeMap.get(nodeId)
  }

  handleNodeStateChange({ state }) {
    // 引擎已终态（completed/error/stopped）后忽略节点状态事件
    if (['completed', 'error', 'stopped'].includes(this.state)) return
    // error/stopped 由 executeNode 的 catch（_handleNodeError）与 stop() 处理，此处不做完成判定
    if (state === 'error' || state === 'stopped') return

    // 计数仅随运行态变化：进入 running/retrying +1，成功 success -1；initialized/pending 等中间态不参与
    // （否则 start 节点初始化瞬间计数归零会误判完成）
    if (state === 'running' || state === 'retrying') {
      this.runningCount++
    } else if (state === 'success') {
      this.runningCount = Math.max(0, this.runningCount - 1)
    } else {
      return
    }

    if (this.runningCount === 0 && this.state === 'running') {
      // 延迟复核：给 next() fire-and-forget 启动的后续节点一个进入 running 的窗口，避免误判
      clearTimeout(this.completeTimer)
      this.completeTimer = setTimeout(() => {
        this.completeTimer = null
        if (this.runningCount === 0 && this.state === 'running') {
          this.cleanup('completed')
          console.error('所有节点执行完成') // 走 stderr，避免污染 stdout JSON 行协议
        }
      }, 100)
    }
  }

  setState(state, error = null) {
    this.state = state
    this.emit('stateChange', state, error)
  }

  async execute() {
    try {
      this.setState('running')
      const startNode = this.nodes.find((node) => !node.parentNode && node.type === 'workflowStart')
      if (!startNode) {
        throw new Error('没有找到起始节点')
      }
      await this.executeNode(startNode.id)
    } catch (error) {
      // _handleNodeError 已 cleanup('error') 并抛出时避免重复 cleanup（否则同一错误触发两次 engine 级 error 事件）
      if (this.state !== 'error') {
        this.cleanup('error', error)
      }
      throw error
    }
  }

  traverseObject(data, callback, currentPath = '', visited = new Set()) {
    if (data === null || data === undefined) {
      callback(currentPath || 'root', data, currentPath, null)
      return
    }

    if (typeof data === 'object') {
      if (visited.has(data)) {
        callback(currentPath || 'root', '[Circular Reference]', currentPath, null)
        return
      }
      visited.add(data)
    }

    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        const newPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`
        callback(index, item, newPath, data)
        if (item !== null && typeof item === 'object') {
          this.traverseObject(item, callback, newPath, visited)
        }
      })
    } else if (typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key
        callback(key, value, newPath, data)
        if (value !== null && typeof value === 'object') {
          this.traverseObject(value, callback, newPath, visited)
        }
      })
    } else {
      callback(currentPath || 'root', data, currentPath, null)
    }

    if (typeof data === 'object') {
      visited.delete(data)
    }
  }

  replaceParameters(paramsString) {
    const params = JSON.parse(paramsString)
    this.traverseObject(params, (key, value, path, parent) => {
      if (typeof value === 'string') {
        if (isParamRefer(value)) {
          parent[key] = getRefer(value)
        }
        if (/^\{\{[^{}]+\.[^{}]+\}\}$/.test(parent[key])) {
          const paramPath = parent[key].slice(2, -2).split('.')
          parent[key] = paramPath.reduce((obj, key) => obj?.[key], this.nodeOutputs)
        } else {
          parent[key] = parent[key].replace(paramReferRegex, (match) => {
            const paramPath = match.slice(2, -2).split('.')
            let paramValue = paramPath.reduce((obj, key) => obj?.[key], this.nodeOutputs)
            if (typeof paramValue !== 'string') {
              paramValue = JSON.stringify(paramValue)
            }
            return paramValue?.trim() || ''
          })
        }
      }
    })
    return params
  }

  async executeNode(nodeId, prevNodeId) {
    const node = this._findNode(nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)

    try {
      const startTime = this.nodeExecuteTime[nodeId] || 0
      const elapsed = Date.now() - startTime
      if (elapsed < 100) {
        await new Promise((resolve) => setTimeout(resolve, 100 - elapsed))
      }
      this.nodeExecuteTime[nodeId] = Date.now()

      if (!Object.prototype.hasOwnProperty.call(node, 'originalConfig')) {
        node.originalConfig = JSON.stringify(node.config)
      }

      // 参数引用解析写入副本：不污染原始 node.config（避免二次执行/调试时原始配置被替换值覆盖）
      const nodeConfig = this.replaceParameters(node.originalConfig)
      const execNode = { ...node, config: { ...nodeConfig } }

      let executor
      if (!this.executorsManager.get(nodeId)) {
        executor = this.executorsManager.create(execNode)
      } else {
        executor = this.executorsManager.get(nodeId)
        executor.node = execNode // 复用执行器时同步最新解析配置
      }

      executor.off('stateChange', this._boundHandleNodeStateChange)
      executor.on('stateChange', this._boundHandleNodeStateChange)

      executor.setInputs(this.getInputs(nodeId, prevNodeId))
      await executor.execute()
    } catch (error) {
      console.error('执行节点失败:', error)
      this.nodeErrorCount[nodeId] = this.nodeErrorCount[nodeId] || 0
      try {
        await this._handleNodeError(nodeId, prevNodeId, error)
      } catch {
        // _handleNodeError 已 cleanup('error') 并决定终态；吞掉其二次抛出，
        // 避免 next() fire-and-forget 链上的 executeNode rejection 变成 unhandled rejection
        // （否则宿主 worker error 事件会再发一次 stateChange error）
      }
    }
  }

  async _handleNodeError(nodeId, prevNodeId, error) {
    const node = this._findNode(nodeId)
    const errorHandleType = node?.config?.errorHandleType

    if (!node || !errorHandleType || errorHandleType === 'stop') {
      this.cleanup('error', error)
      throw error
    }

    if (errorHandleType === 'retry') {
      const maxRetry = node.config.errorHandleRetryCount || 0
      if (maxRetry > this.nodeErrorCount[nodeId]) {
        this.nodeErrorCount[nodeId]++
        const executor = this.executorsManager.get(nodeId)
        if (executor) {
          executor.setState('retrying', this.nodeErrorCount[nodeId])
        }
        const interval = node.config.errorHandleRetryInterval || 0
        if (interval > 0) {
          await new Promise((resolve) => setTimeout(resolve, interval))
        }
        await this.executeNode(nodeId, prevNodeId)
        return
      }
      return await this._handleRetryFailed(nodeId, error, node.config.errorHandleRetryFailed || 'stop', node)
    }

    return await this._handleRetryFailed(nodeId, error, errorHandleType, node)
  }

  async _handleRetryFailed(nodeId, error, action, node) {
    switch (action) {
      case 'stop':
        this.cleanup('error', error)
        throw error
      case 'ignore':
        this.next(nodeId)
        break
      case 'specify': {
        const targetNode = node?.config?.errorHandleSpecifyNode
        if (targetNode) {
          this.nodeErrorCount[nodeId] = 0
          await this.executeNode(targetNode, '')
        }
        break
      }
      case 'retryFlow':
        await this.retryFlow()
        break
    }
  }

  getInputs(nodeId, prevNodeId) {
    const inputValues = {}
    const inputEdges = this.edges.filter((e) => e.target === nodeId && e.targetHandle !== 'prev')
    const prevNodeOutputs = {}

    for (const inputEdge of inputEdges) {
      const sourceNodeOutputs = this.nodeOutputs[inputEdge.source]
      if (sourceNodeOutputs) {
        if (inputEdge.source === prevNodeId) {
          prevNodeOutputs[inputEdge.targetHandle] = sourceNodeOutputs[inputEdge.sourceHandle]
        } else {
          inputValues[inputEdge.targetHandle] = sourceNodeOutputs[inputEdge.sourceHandle]
        }
      }
    }

    Object.keys(prevNodeOutputs).forEach((key) => {
      inputValues[key] = prevNodeOutputs[key]
    })

    const startNode = this._findNode(nodeId)
    if (startNode && startNode.type === 'workflowStart') {
      for (const key in this.startInputs) {
        inputValues[key] = this.startInputs[key]
      }
    }

    return inputValues
  }

  setOutputs(nodeId, outputs) {
    if (!this.nodeOutputs[nodeId]) {
      this.nodeOutputs[nodeId] = {}
    }
    for (const key in outputs) {
      this.nodeOutputs[nodeId][key] = outputs[key]
    }
  }

  getOutputs(nodeId) {
    return this.nodeOutputs[nodeId]
  }

  async executeSubFlow(masterNodeId, startInputs) {
    const subFlowNodeId = masterNodeId + '-subFlow'
    const childNodes = JSON.parse(
      JSON.stringify(this.allNodes.filter((n) => n.parentNode === subFlowNodeId))
    ).map((n) => {
      n.parentNode = null
      n.masterNodeId = masterNodeId
      return n
    })
    const childEdges = JSON.parse(
      JSON.stringify(
        this.allEdges.filter((e) =>
          childNodes.some((n) => n.id === e.source || n.id === e.target)
        )
      )
    )

    if (childNodes.length === 0) {
      return
    }

    return new Promise((resolve, reject) => {
      const engine = new WorkflowExecutor({
        id: this.id,
        global: this.global,
        debug: this.debug,
        isSubFlow: true,
        ioRoots: this.ioRoots,
        pluginRoots: this.pluginRoots, // 子流程内的插件节点同样需要插件目录定位（此前遗漏导致子流程插件必失败）
        nodes: childNodes,
        edges: childEdges,
        allNodes: this.allNodes,
        allEdges: this.allEdges,
        nodeOutputs: this.nodeOutputs,
        startInputs
      })
      this.subFlows.set(subFlowNodeId, engine)

      engine.on('stateChange', (state, error) => {
        if (state === 'completed' || state === 'stopped') {
          engine.removeAllListeners()
          this.subFlows.delete(subFlowNodeId)
          const endNode = childNodes.find((n) => n.type === 'workflowEnd')
          if (endNode) {
            resolve(this.getOutputs(endNode.id))
          } else {
            resolve()
          }
        } else if (state === 'error') {
          engine.removeAllListeners()
          this.subFlows.delete(subFlowNodeId)
          reject(new Error(error?.message || 'SubFlow error'))
        }
      })

      engine.execute()
    })
  }

  async next(nodeId) {
    this.nodeErrorCount[nodeId] = 0

    let nextEdges = this.edges.filter(
      (edge) => edge.source === nodeId && edge.sourceHandle === 'next'
    )

    const node = this._findNode(nodeId)
    if (node?.type === 'workflowIf' && this.nodeOutputs[nodeId]?.result === false) {
      nextEdges = this.edges.filter(
        (edge) => edge.source === nodeId && edge.sourceHandle === 'next-false'
      )
    }

    nextEdges.forEach((edge) => {
      const targetNode = this._findNode(edge.target)
      if (!targetNode || targetNode.deactivate) return
      this.executeNode(targetNode.id, nodeId)
    })
  }

  async retryFlow() {
    this.setState('retrying')

    for (const subFlow of this.subFlows.values()) {
      await subFlow.stop()
    }
    this.subFlows.clear()

    await this.executorsManager.cleanup()

    clearTimeout(this.completeTimer)
    this.completeTimer = null

    this.executorsManager = new ExecutorManager(this)
    this.runningCount = 0
    this.nodeErrorCount = {}
    this.nodeExecuteTime = {}
    this.nodeOutputs = {}

    await new Promise((resolve) => setTimeout(resolve, 100))
    await this.execute()
  }

  async stop() {
    this.setState('stopping')
    await this.cleanup()
  }

  async cleanup(status = 'stopped', error = null) {
    for (const subFlow of this.subFlows.values()) {
      await subFlow.stop()
    }
    this.subFlows.clear()

    await this.executorsManager.cleanup()
    clearTimeout(this.completeTimer)
    this.completeTimer = null
    this.runningCount = 0

    if (!this.isSubFlow) {
      this.allNodes = null
      this.allEdges = null
      this.global = null
    }
    this.nodes = null
    this.edges = null
    this.debug = false
    this.startInputs = null
    this.nodeExecuteTime = null
    this.nodeErrorCount = null
    this.nodeOutputs = null

    this.setState(status, error)

    if (!this.isSubFlow) {
      this.removeAllListeners()
    }
  }
}

export default WorkflowExecutor
