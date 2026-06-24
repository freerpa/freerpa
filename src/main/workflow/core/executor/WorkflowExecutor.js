import { EventEmitter } from 'events'
import ExecutorManager from '../manger/ExecutorManager'
import { isParamRefer, getRefer, paramReferRegex } from '@renderer/workflow/utils/paramRefer'
EventEmitter.setMaxListeners(10000)

class WorkflowExecutor extends EventEmitter {
  constructor(options) {
    super()

    if (!Array.isArray(options.nodes) || !Array.isArray(options.edges)) {
      throw new Error('Invalid workflow data: nodes and edges must be arrays')
    }

    // 检查节点数据
    options.nodes.forEach((node) => {
      if (!node.id || !node.type) {
        throw new Error(`Invalid node data: ${JSON.stringify(node)}`)
      }
    })
    this.id = options.id // 工作流id
    // 全局变量
    this.global = options.global || {
      opendBitBrowser: [],
      opendCdpBrowser: []
    }
    this.debug = options.debug || false // 是否开启调试模式
    this.isSubFlow = options.isSubFlow || false // 是否是子工作流
    this.subFlows = new Map() // 子工作流
    this.allNodes = options.allNodes // 所有节点
    this.allEdges = options.allEdges // 所有边
    this.nodes = options.nodes // 当前执行节点
    this.edges = options.edges // 当前执行边
    this.executorsManager = new ExecutorManager(this) // 执行器管理器
    this.state = 'pending' // 状态
    this.startInputs = options.startInputs || {} // 工作流开始节点输入
    this.nodeOutputs = options.nodeOutputs || {} // 存储每个节点的输出
    this.timer = null // 定时器
    this.nodeExecuteTime = {} // 记录每个节点的执行时间
    this.nodeErrorCount = {} // 记录每个节点的错误次数
  }

  // 处理节点状态变化
  handleNodeStateChange({ nodeId, state, error }) {
    // 如果工作流已经结束，不再处理状态变化
    if (this.state === 'completed' || this.state === 'error') {
      return
    }
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      // 检查是否所有节点都执行完成
      const allCompleted = this.nodes?.every((node) => {
        const executor = this.executorsManager.get(node.id)
        return executor?.getState() !== 'running' && executor?.getState() !== 'retrying'
      })

      // 如果所有节点都执行完成，设置工作流状态为完成
      if (allCompleted) {
        this.cleanup('completed')
        console.log('所有节点执行完成')
      }
    }, 250)
  }

  // 设置工作流状态
  setState(state, error = null) {
    this.state = state
    // 发送状态变化事件
    this.emit('stateChange', state, error)
  }

  //执行工作流
  async execute() {
    try {
      // 设置工作流状态为运行中
      this.setState('running')
      // 找到起始节点
      const startNode = this.nodes.find((node) => !node.parentNode && node.type === 'startNode')
      if (!startNode) {
        throw new Error('没有找到起始节点')
      }
      this.executeNode(startNode.id)
    } catch (error) {
      this.cleanup('error', error)
      throw error
    }
  }

  /**
   * 递归遍历对象或数组的所有属性
   * @param {Object|Array} data - 要遍历的数据（对象或数组）
   * @param {Function} callback - 处理每个属性的回调函数，接收 (key, value, path, parent) 参数
   * @param {string} currentPath - 内部使用，当前属性的路径
   * @param {Set} visited - 内部使用，用于检测循环引用
   */
  traverseObject(data, callback, currentPath = '', visited = new Set()) {
    // 处理空值情况
    if (data === null || data === undefined) {
      callback(currentPath || 'root', data, currentPath, null)
      return
    }

    // 检测循环引用（如果已访问过则终止递归）
    if (typeof data === 'object') {
      if (visited.has(data)) {
        callback(currentPath || 'root', '[Circular Reference]', currentPath, null)
        return
      }
      visited.add(data) // 将当前对象加入已访问集合
    }

    // 处理数组
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        const key = index
        const newPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`
        // 调用回调处理当前元素
        callback(key, item, newPath, data)
        // 如果元素是对象或数组，继续递归遍历
        if (item !== null && typeof item === 'object') {
          this.traverseObject(item, callback, newPath, visited)
        }
      })
    }
    // 处理对象（排除数组，因为数组已被单独处理）
    else if (typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key
        // 调用回调处理当前属性
        callback(key, value, newPath, data)
        // 如果属性值是对象或数组，继续递归遍历
        if (value !== null && typeof value === 'object') {
          this.traverseObject(value, callback, newPath, visited)
        }
      })
    }
    // 处理基本类型（非对象/数组）
    else {
      callback(currentPath || 'root', data, currentPath, null)
    }

    // 遍历完成后从已访问集合中移除（避免影响其他分支遍历）
    if (typeof data === 'object') {
      visited.delete(data)
    }
  }

  // 替换参数引用
  replaceParameters(paramsString) {
    const params = JSON.parse(paramsString)
    this.traverseObject(params, (key, value, path, parent) => {
      if (typeof value === 'string') {
        if (isParamRefer(value)) {
          parent[key] = getRefer(value)
        }
        if (/^\{\{[^\{\}]+\.[^\{\}]+\}\}$/.test(parent[key])) {
          const paramPath = parent[key].slice(2, -2).split('.') // 获取参数路径
          parent[key] = paramPath.reduce((obj, key) => obj?.[key], this.nodeOutputs)
        } else {
          parent[key] = parent[key].replace(paramReferRegex, (match) => {
            const paramPath = match.slice(2, -2).split('.') // 获取参数路径
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

  // 执行节点
  async executeNode(nodeId, prevNodeId) {
    const node = this.nodes.find((n) => n.id === nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)
    try {
      //查询节点开始执行时间，如果执行时间过快则延迟执行
      const startTime = this.nodeExecuteTime[nodeId] || 0
      await new Promise((resolve) => setTimeout(resolve, 100 - (Date.now() - startTime)))
      //记录节点开始执行时间
      this.nodeExecuteTime[nodeId] = Date.now()
      // 创建执行器
      let executor
      if (!this.executorsManager.get(nodeId)) {
        executor = this.executorsManager.create(node)
      } else {
        executor = this.executorsManager.get(nodeId)
      }

      // 如果节点没有originalConfig，则创建一个
      if (!Object.prototype.hasOwnProperty.call(node, 'originalConfig')) {
        node.originalConfig = JSON.stringify(node.config)
      }
      // 替换参数引用
      const nodeConfig = this.replaceParameters(node.originalConfig)
      // 赋值给节点配置
      Object.keys(nodeConfig).forEach((key) => {
        node.config[key] = nodeConfig[key]
      })
      // 监听节点状态变化
      executor.on('stateChange', this.handleNodeStateChange.bind(this))
      // 设置输入
      executor.setInputs(this.getInputs(nodeId, prevNodeId))
      // 执行节点
      await executor.execute()
    } catch (error) {
      console.error('执行节点失败:', error)
      // 错误次数默认值为0
      this.nodeErrorCount[nodeId] = this.nodeErrorCount[nodeId] || 0
      // 如果节点没有配置错误处理类型，或者配置为stop，则终止执行
      if (!node || !node.config.hasOwnProperty('errorHandleType') || node.config.errorHandleType === 'stop') {
        // 设置状态为错误
        this.cleanup('error', error)
        throw error
      } else if (node.config.errorHandleType === 'retry') {
        // 如果重试次数超过最大重试次数
        if (node.config.errorHandleRetryCount <= this.nodeErrorCount[nodeId]) {
          // 如果重试次数超过最大重试次数，根据配置决定是否终止
          if (node.config.errorHandleRetryFailed === 'stop') {
            // 设置状态为错误
            this.cleanup('error', error)
            throw error
          } else if (node.config.errorHandleRetryFailed === 'ignore') {
            // 忽略错误，继续执行下一个节点
            this.next(nodeId)
          } else if (node.config.errorHandleRetryFailed === 'specify' && node.config.errorHandleSpecifyNode) {
            // 指定跳转节点
            this.nodeErrorCount[nodeId] = 0
            await this.executeNode(node.config.errorHandleSpecifyNode, "")
          } else if (node.config.errorHandleRetryFailed === 'retryFlow') {
            // 重试整个工作流
            await this.retryFlow()
          }
          return
        }
        // 重试次数累加
        this.nodeErrorCount[nodeId]++
        // 设置状态为重试中
        this.executorsManager.get(nodeId).setState('retrying', this.nodeErrorCount[nodeId])
        // 等待重试间隔
        await new Promise((resolve) => setTimeout(resolve, node.config.errorHandleRetryInterval))
        // 重新执行节点
        await this.executeNode(nodeId, prevNodeId)
      } else if (node.config.errorHandleType === 'ignore') {
        // 忽略错误，继续执行下一个节点
        this.next(nodeId)
      } else if (node.config.errorHandleType === 'specify' && node.config.errorHandleSpecifyNode) {
        // 指定跳转节点
        this.nodeErrorCount[nodeId] = 0
        await this.executeNode(node.config.errorHandleSpecifyNode, "")
      } else if (node.config.errorHandleType === 'retryFlow') {
        // 重试整个工作流
        this.retryFlow()
      }
    }
  }

  // 获取节点输入
  getInputs(nodeId, prevNodeId) {
    // 获取目标节点的所有输入参数
    const inputValues = {}
    const inputEdges = this.edges.filter((e) => e.target === nodeId && e.targetHandle !== 'prev')

    //上一个节点的输出暂存
    const prevNodeOutputs = {}

    // 遍历这些边，找到对应的目标节点
    for (const inputEdge of inputEdges) {
      const sourceNodeOutputs = this.nodeOutputs[inputEdge.source]

      if (sourceNodeOutputs) {
        // 如果输入边是当前节点，放入暂存
        if (inputEdge.source === prevNodeId) {
          prevNodeOutputs[inputEdge.targetHandle] = sourceNodeOutputs[inputEdge.sourceHandle]
        } else {
          // 如果输入边不是当前节点，使用最后一个连接节点的输出
          inputValues[inputEdge.targetHandle] = sourceNodeOutputs[inputEdge.sourceHandle]
        }
      }
    }

    // 如果上一个节点的输出不为空，则优先使用上一个节点的输出
    Object.keys(prevNodeOutputs).forEach((key) => {
      inputValues[key] = prevNodeOutputs[key]
    })

    // 检查是否开始节点
    const startNode = this.nodes.find((n) => n.id === nodeId && n.type === 'startNode')
    if (startNode) {
      // 将工作流开始节点输入赋值给当前节点输入
      for (const key in this.startInputs) {
        inputValues[key] = this.startInputs[key]
      }
    }

    return inputValues
  }

  // 设置节点输出
  setOutputs(nodeId, outputs) {
    // 如果节点输出为空，则创建一个空对象
    if (!this.nodeOutputs[nodeId]) {
      this.nodeOutputs[nodeId] = {}
    }
    for (const key in outputs) {
      this.nodeOutputs[nodeId][key] = outputs[key]
    }
  }

  // 获取节点输出
  getOutputs(nodeId) {
    return this.nodeOutputs[nodeId]
  }

  //执行子工作流
  async executeSubFlow(masterNodeId, startInputs) {
    return new Promise((resolve, reject) => {
      const subFlowNodeId = masterNodeId + '-subFlow'
      // 获取子工作流节点
      const childNodes = JSON.parse(
        JSON.stringify(this.allNodes.filter((n) => n.parentNode === subFlowNodeId))
      ).map((n) => {
        n.parentNode = null
        n.masterNodeId = masterNodeId
        return n
      })
      // 获取子工作流边
      const childEdges = JSON.parse(
        JSON.stringify(
          this.allEdges.filter((e) =>
            childNodes.some((n) => n.id === e.source || n.id === e.target)
          )
        )
      )
      // 如果子工作流节点为空，则直接返回
      if (childNodes.length === 0) {
        resolve()
        return
      }

      // 执行子工作流
      let engine = new WorkflowExecutor({
        id: this.id,
        global: this.global,
        debug: this.debug,
        isSubFlow: true,
        nodes: childNodes,
        edges: childEdges,
        allNodes: this.allNodes,
        allEdges: this.allEdges,
        nodeOutputs: this.nodeOutputs,
        startInputs
      })
      this.subFlows.set(subFlowNodeId, engine)
      engine.execute()
      engine.on('stateChange', (state, error) => {
        if (state === 'completed' || state === 'stopped') {
          engine = null
          this.subFlows.delete(subFlowNodeId)
          // 获取子工作流结束节点
          const endNode = childNodes.find((n) => n.type === 'endNode')
          // 如果结束节点存在，则返回结束节点的输出
          if (endNode) {
            resolve(this.getOutputs(endNode.id))
          } else {
            resolve()
          }
        } else if (state === 'error') {
          engine = null
          this.subFlows.delete(subFlowNodeId)
          reject(new Error(error.message))
        }
      })
    })
  }

  // 修改 next 方法，添加条件验证
  async next(nodeId) {
    // 重置节点错误次数
    this.nodeErrorCount[nodeId] = 0
    // 获取所有与当前节点的 next 连接的边
    let nextEdges = this.edges.filter(
      (edge) => edge.source === nodeId && edge.sourceHandle === 'next'
    )

    // 获取当前节点
    const node = this.nodes.find((n) => n.id === nodeId)

    // 如果当前节点是logicIf，并且结果为false，则使用next-false的边
    if (node.type === 'logicIf' && this.nodeOutputs[nodeId].result === false) {
      nextEdges = this.edges.filter(
        (edge) => edge.source === nodeId && edge.sourceHandle === 'next-false'
      )
    }

    // 遍历这些边，找到对应的目标节点
    for (const edge of nextEdges) {
      const targetNode = this.nodes.find((n) => n.id === edge.target && !n.deactivate)
      if (!targetNode) continue

      try {
        // 执行目标节点，传递所有相关输入参数
        this.executeNode(targetNode.id, nodeId)
      } catch (error) {
        // 设置状态为错误
        this.cleanup('error', error)
        throw error
      }
    }
  }

  // 重试工作流
  async retryFlow() {
    // 设置状态为重试中
    this.setState('retrying')
    // 清理子工作流
    for (const subFlow of this.subFlows.values()) {
      await subFlow.stop()
    }
    // 清理执行器管理器
    await this.executorsManager.cleanup()
    // 清理节点状态检查定时器（不然有可能会超出250毫秒导致工作流停止无法重启）
    clearTimeout(this.timer)
    // 重置执行器管理器
    this.executorsManager = new ExecutorManager(this)
    // 重置节点错误次数
    this.nodeErrorCount = {}
    // 重置节点执行时间
    this.nodeExecuteTime = {}
    // 重置节点输出
    this.nodeOutputs = {}
    // 等待100毫秒，防止过快
    await new Promise((resolve) => setTimeout(resolve, 100))
    // 重新执行工作流
    this.execute()
  }

  // 停止工作流
  async stop() {
    // 先设置状态为正在停止
    this.setState('stopping')
    // 清理工作流
    await this.cleanup()
  }

  // 清理工作流
  async cleanup(status = 'stopped', error = null) {
    // 清理子工作流
    for (const subFlow of this.subFlows.values()) {
      await subFlow.stop()
    }
    // 清理当前工作流
    this.nodes = null
    this.debug = false
    this.edges = null
    this.timer = null
    this.state = null
    this.startInputs = null
    this.nodeExecuteTime = null
    this.nodeErrorCount = null
    // 清理执行器管理器
    await this.executorsManager.cleanup()
    // 设置工作流状态为已停止
    this.setState(status, error)
    // 如果当前工作流是不是子工作流，则清理
    if (!this.isSubFlow) {
      // 清理工作流
      this.allNodes = null
      this.allEdges = null
      this.global = null
      this.nodeOutputs = null
      this.removeAllListeners()
    }
  }
}

export default WorkflowExecutor
