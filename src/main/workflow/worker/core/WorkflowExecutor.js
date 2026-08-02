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
    this.debug = options.debug || false
    this.isSubFlow = options.isSubFlow || false
    this.ioRoots = options.ioRoots || []
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
    this.startInputs = options.startInputs || {}
    this.nodeOutputs = options.nodeOutputs || {}
    this.timer = null
    this.nodeExecuteTime = {}
    this.nodeErrorCount = {}

    this._boundHandleNodeStateChange = this.handleNodeStateChange.bind(this)
  }

  _findNode(nodeId) {
    return this._nodeMap.get(nodeId)
  }

  handleNodeStateChange({ nodeId, state, error }) {
    if (this.state === 'completed' || this.state === 'error') {
      return
    }
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      const allCompleted = this.nodes?.every((node) => {
        const executor = this.executorsManager.get(node.id)
        return executor?.getState() !== 'running' && executor?.getState() !== 'retrying'
      })

      if (allCompleted) {
        this.cleanup('completed')
        console.log('所有节点执行完成')
      }
    }, 250)
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
      this.cleanup('error', error)
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
        if (/^\{\{[^\{\}]+\.[^\{\}]+\}\}$/.test(parent[key])) {
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

      let executor
      if (!this.executorsManager.get(nodeId)) {
        executor = this.executorsManager.create(node)
      } else {
        executor = this.executorsManager.get(nodeId)
      }

      if (!Object.prototype.hasOwnProperty.call(node, 'originalConfig')) {
        node.originalConfig = JSON.stringify(node.config)
      }

      const nodeConfig = this.replaceParameters(node.originalConfig)
      Object.keys(nodeConfig).forEach((key) => {
        node.config[key] = nodeConfig[key]
      })

      executor.off('stateChange', this._boundHandleNodeStateChange)
      executor.on('stateChange', this._boundHandleNodeStateChange)

      executor.setInputs(this.getInputs(nodeId, prevNodeId))
      await executor.execute()
    } catch (error) {
      console.error('执行节点失败:', error)
      this.nodeErrorCount[nodeId] = this.nodeErrorCount[nodeId] || 0
      await this._handleNodeError(nodeId, prevNodeId, error)
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

    clearTimeout(this.timer)
    this.timer = null

    this.executorsManager = new ExecutorManager(this)
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

    clearTimeout(this.timer)
    this.timer = null

    await this.executorsManager.cleanup()

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
