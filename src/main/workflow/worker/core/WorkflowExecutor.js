import { EventEmitter } from 'node:events'
import ExecutorManager from './ExecutorManager.js'
import { isParamRefer, getRefer, paramReferRegex } from './paramRefer.js'
import { bridge } from '../bridge.js'

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
      opendCdpBrowser: []
    }
    // 本地网络服务默认端口（主进程 init 注入，设置中心可配）：挂 global 供 http-server.js 创建共享服务时监听，
    // 执行器无需感知端口（getHttpServer 返回的 server 对象自带 .port）
    // 用 ?? 而非 ||：isolated 实例注入 0（OS 随机端口）时必须保留，否则 N 个实例都抢 9264 → EADDRINUSE
    this.global.networkServerPort = options.networkServerPort ?? 9264
    this.debug = options.debug || false
    this.isSubFlow = options.isSubFlow || false
    this.ioRoots = options.ioRoots || []
    this.pluginRoots = options.pluginRoots || [] // 插件目录（主进程 init 注入，pluginCall 执行器据此定位插件）
    this.devPluginDirs = options.devPluginDirs || [] // 开发版插件挂载目录（主进程 init 注入，开发版优先）
    this.subFlows = new Map()
    this.allNodes = options.allNodes
    this.allEdges = options.allEdges
    this.nodes = options.nodes
    this.edges = options.edges

    this._nodeMap = new Map()
    if (this.nodes) {
      this.nodes.forEach((n) => this._nodeMap.set(n.id, n))
    }

    // 邻接表预计算：getInputs/next 按节点 O(1) 取边，避免每次执行全量过滤 O(N*E)
    this._inEdges = new Map()
    this._outEdges = new Map()
    if (this.edges) {
      for (const edge of this.edges) {
        if (edge.targetHandle !== 'prev') {
          if (!this._inEdges.has(edge.target)) this._inEdges.set(edge.target, [])
          this._inEdges.get(edge.target).push(edge)
        }
        if (!this._outEdges.has(edge.source)) this._outEdges.set(edge.source, [])
        this._outEdges.get(edge.source).push(edge)
      }
    }

    this.executorManager = new ExecutorManager(this)
    this.state = 'pending'
    this.completeTimer = null // 完成判定复核计时器（运行节点清空后延迟一窗口，等待 next() 启动的后续节点）
    this.startInputs = options.startInputs || {}
    this.nodeOutputs = options.nodeOutputs || {}
    this.nodeExecuteTime = {}
    this.nodeErrorCount = {}
    // 运行中的节点集合：既用于完成判定（集合为空 = 全部完成），也用于 worker 级异常定位失败节点。
    // 用集合而非计数，避免 retrying → running 的重复累加导致流程永不完成
    this.runningNodeIds = new Set()
    // 正在执行的错误处理计数：处理期间不做“全部完成”判定，避免 error 与 completed 竞态
    this.errorHandlingCount = 0
    // 正在销毁流程（停止/结束）：销毁钩子会关闭浏览器等资源，正在执行的节点会被中断，
    // 这类中断（如 CDP 的 Target closed）属于主动终止的预期结果，不能再上报为节点错误
    this.finalizing = false

    this._boundHandleNodeStateChange = this._handleNodeStateChange.bind(this)
  }

  _findNode(nodeId) {
    return this._nodeMap.get(nodeId)
  }

  _handleNodeStateChange({ nodeId, state, error }) {
    // 主动终止/结束流程期间：节点被资源释放中断，不上报错误
    if (this.finalizing) return
    // 引擎已终态（completed/error/stopped）后忽略节点状态事件
    if (['completed', 'error', 'stopped'].includes(this.state)) return

    // 维护运行中节点集合：既用于完成判定，也供 worker 级未捕获异常定位失败节点。
    // retrying → running 重复进入集合无副作用（Set 去重），避免计数重复累加
    if (nodeId) {
      if (state === 'running' || state === 'retrying') this.runningNodeIds.add(nodeId)
      else this.runningNodeIds.delete(nodeId)
    }

    // 节点报错统一在状态事件处处理：覆盖执行器内部同步抛错、next() 输出校验失败、
    // 以及异步回调里自行 setState('error') 三类路径。executeNode 的 catch 通过
    // errorHandledByEvent 去重，避免同一错误被处理两次。
    if (state === 'error') {
      const executor = this.executorManager.get(nodeId)
      if (executor) executor.errorHandledByEvent = true
      if (this.nodeErrorCount && !['error', 'stopped', 'completed'].includes(this.state)) {
        const node = this._findNode(nodeId)
        const detail = typeof error === 'string' ? error : error?.message || '节点执行失败'
        const nodeError = new Error(`节点【${node?.name || nodeId}】执行失败：${detail}`)
        this._runNodeErrorHandler(nodeId, null, nodeError).catch(() => {})
      } else {
        // 节点已退出运行态：若错误被“忽略/跳转”且没有后续节点，仍需正常判定完成
        this._checkCompleted()
      }
      return
    }
    if (state === 'stopped') return

    // 集合仅随运行态变化：running/retrying 加入，success 移除；initialized/pending 等中间态不参与
    // （否则 start 节点初始化瞬间集合为空会误判完成）
    if (state === 'running' || state === 'retrying') {
      const executor = this.executorManager.get(nodeId)
      if (executor) executor.errorHandledByEvent = false
    } else if (state !== 'success') {
      return
    }

    this._checkCompleted()
  }

  /** 统一的节点错误处理入口：处理期间暂停完成判定，处理结束后再复核（retry/ignore 后仍能正常完成） */
  async _runNodeErrorHandler(nodeId, prevNodeId, error) {
    this.errorHandlingCount++
    try {
      await this._handleNodeError(nodeId, prevNodeId, error)
    } finally {
      this.errorHandlingCount = Math.max(0, this.errorHandlingCount - 1)
      this._checkCompleted()
    }
  }

  /** 运行中计数归零后延迟复核：给 next() fire-and-forget 启动的后续节点进入 running 的窗口 */
  _checkCompleted() {
    if (this.errorHandlingCount > 0) return
    if (this.runningNodeIds.size !== 0 || this.state !== 'running') return
    clearTimeout(this.completeTimer)
    this.completeTimer = setTimeout(() => {
      this.completeTimer = null
      if (this.runningNodeIds.size === 0 && this.state === 'running') {
        this.cleanup('completed')
        console.error('所有节点执行完成') // 走 stderr，避免污染 stdout JSON 行协议
      }
    }, 100)
  }

  /** worker 级未捕获异常/未处理 rejection 上报：附带正在运行的节点名，避免“执行失败但无节点报错” */
  reportError(error) {
    if (this.finalizing) return
    if (!this.nodeErrorCount || ['error', 'stopped', 'completed'].includes(this.state)) return
    const detail = error?.message || String(error || '未知异常')
    const running = [...(this.runningNodeIds || [])]
      .map((id) => this._findNode(id)?.name || id)
      .filter(Boolean)
    const message = running.length
      ? `执行异常（运行中的节点：${running.join('、')}）：${detail}`
      : `执行异常：${detail}`
    const wrapped = new Error(message)
    // 先把运行中的节点标记为 error：worker 级异常没有走节点状态事件，不补发时画布上看不到任何节点报错
    for (const id of this.runningNodeIds) {
      try {
        bridge.sendEvent(`flowEventBus:nodeStatus:${this.id}:${id}`, { state: 'error', error: message })
      } catch {
        // 事件通道不可用时忽略，终态上报仍会带上失败节点名
      }
    }
    // 先同步上报终态（worker 可能因未捕获异常被终止，异步销毁钩子来不及完成）
    this.setState('error', wrapped)
    this.cleanup('error', wrapped).catch(() => {})
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
        await this.cleanup('error', error)
      }
      throw error
    }
  }

  // 深度遍历任意嵌套对象（含循环引用防护），回调可写入修改父对象
  _traverseObject(data, callback, visited = new Set()) {
    if (data === null || typeof data !== 'object') {
      callback(data, null)
      return
    }

    if (visited.has(data)) {
      callback('[Circular Reference]', null)
      return
    }
    visited.add(data)

    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        callback(index, item, data)
        if (item !== null && typeof item === 'object') {
          this._traverseObject(item, callback, visited)
        }
      })
    } else {
      Object.entries(data).forEach(([key, value]) => {
        callback(key, value, data)
        if (value !== null && typeof value === 'object') {
          this._traverseObject(value, callback, visited)
        }
      })
    }

    visited.delete(data)
  }

  /** 整个字符串恰好是一个参数引用 {{x.y}} */
  _isWholeStringRefer(value) {
    return /^\{\{[^{}]+\.[^{}]+\}\}$/.test(value)
  }

  /** 从 nodeOutputs 中按引用路径取值，如 {{a.b}} → nodeOutputs.a.b */
  _lookupNodeOutput(refer) {
    const paramPath = refer.slice(2, -2).split('.')
    return paramPath.reduce((obj, key) => obj?.[key], this.nodeOutputs)
  }

  // 解析节点配置字符串中的参数引用，返回解析后的配置副本
  resolveConfigReferences(configString) {
    const config = JSON.parse(configString)
    this._traverseObject(config, (key, value, parent) => {
      if (typeof value !== 'string') return

      // 参数引用值（含旧值分隔符）先还原为纯引用串 {{x.y}}
      if (isParamRefer(value)) {
        parent[key] = getRefer(value)
      }

      const current = parent[key]
      if (this._isWholeStringRefer(current)) {
        // 整串即引用 → 直接替换为引用值（保留对象/数字等原始类型）
        parent[key] = this._lookupNodeOutput(current)
      } else {
        // 引用内嵌在普通字符串中 → 逐段替换为字符串
        parent[key] = current.replace(paramReferRegex, (match) => {
          const referValue = this._lookupNodeOutput(match)
          const text = typeof referValue !== 'string' ? JSON.stringify(referValue) : referValue
          return text?.trim() || ''
        })
      }
    })
    return config
  }

  // 同一节点两次启动的最小间隔（节流）：紧凑循环中防止节点被过于频繁地重复执行
  async _throttleNodeStart(nodeId) {
    const MIN_INTERVAL = 100
    const lastStart = this.nodeExecuteTime[nodeId] || 0
    const elapsed = Date.now() - lastStart
    if (elapsed < MIN_INTERVAL) {
      await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL - elapsed))
    }
    this.nodeExecuteTime[nodeId] = Date.now()
  }

  async executeNode(nodeId, prevNodeId) {
    const node = this._findNode(nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)

    try {
      await this._throttleNodeStart(nodeId)

      if (!Object.prototype.hasOwnProperty.call(node, 'originalConfig')) {
        node.originalConfig = JSON.stringify(node.config)
      }

      // 参数引用解析写入副本：不污染原始 node.config（避免二次执行/调试时原始配置被替换值覆盖）
      const nodeConfig = this.resolveConfigReferences(node.originalConfig)
      const execNode = { ...node, config: { ...nodeConfig } }

      // 执行器仅首次创建时绑定状态监听（复用时不重复 off/on）
      let executor = this.executorManager.get(nodeId)
      if (!executor) {
        executor = this.executorManager.create(execNode)
        executor.on('stateChange', this._boundHandleNodeStateChange)
      } else {
        executor.node = execNode // 复用执行器时同步最新解析配置
      }

      executor.setInputs(this.getInputs(nodeId, prevNodeId))
      await executor.execute()
    } catch (error) {
      // 主动终止/结束流程时，销毁钩子已关闭浏览器等资源，正在执行的节点被中断属于预期结果：
      // 直接忽略，不再上报节点错误（否则点击停止会看到“Target closed”之类的红色节点报错）
      if (this.finalizing) return
      const nodeName = node?.name || nodeId
      const detail = error?.message || String(error)
      const nodeError = detail.startsWith(`节点【${nodeName}】`)
        ? error
        : new Error(`节点【${nodeName}】执行失败：${detail}`)
      console.error('执行节点失败:', nodeError)
      // 终态后（cleanup 已把 nodeErrorCount 置 null）仍可能有 fire-and-forget 链上的节点出错：
      // 直接忽略，避免访问 null 抛 TypeError → unhandled rejection，导致该节点错误状态无法上报
      if (!this.nodeErrorCount || ['error', 'stopped', 'completed'].includes(this.state)) {
        return
      }
      // 同一次错误已由 stateChange 事件统一处理（含 ignore/retry/specify/stop 决策），此处不重复处理
      const executor = this.executorManager.get(nodeId)
      if (executor?.errorHandledByEvent) {
        executor.errorHandledByEvent = false
        return
      }
      // 兜底标记节点错误：错误发生在执行器建立/初始化之前（配置解析、执行器创建失败）时没有
      // stateChange 事件，画布上不会出现任何节点报错，这里补发节点错误状态便于定位
      if (!executor || executor.state !== 'error') {
        try {
          bridge.sendEvent(`flowEventBus:nodeStatus:${this.id}:${nodeId}`, {
            state: 'error',
            error: nodeError.message
          })
        } catch {
          // 事件通道不可用时忽略，终态上报仍会带上失败节点名
        }
      }
      this.nodeErrorCount[nodeId] = this.nodeErrorCount[nodeId] || 0
      try {
        await this._runNodeErrorHandler(nodeId, prevNodeId, nodeError)
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
      // 结束流程：await 确保销毁钩子（关闭打开的浏览器）执行完毕、且错误状态可靠上报后再中止
      await this.cleanup('error', error)
      throw error
    }

    if (errorHandleType === 'retry') {
      const maxRetry = node.config.errorHandleRetryCount || 0
      if (maxRetry > this.nodeErrorCount[nodeId]) {
        this.nodeErrorCount[nodeId]++
        const executor = this.executorManager.get(nodeId)
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
        // 结束流程：await 确保销毁钩子（关闭打开的浏览器）执行完毕、且错误状态可靠上报后再中止
        await this.cleanup('error', error)
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
    const inputEdges = this._inEdges.get(nodeId) || []
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
    // 父流程已进入终止流程（停止/结束）：不再创建新的子流程引擎。
    // 否则循环类节点在父流程销毁后仍会继续下一轮，新建子引擎（finalizing 为 false）会在
    // 已被关闭的浏览器上执行并把子节点标红，出现“点了停止反而报错”的观感
    if (this.finalizing) return
    const subFlowNodeId = masterNodeId + '-subFlow'
    const childNodes = structuredClone(
      this.allNodes.filter((n) => n.parentNode === subFlowNodeId)
    ).map((n) => {
      n.parentNode = null
      n.masterNodeId = masterNodeId
      return n
    })
    const childEdges = structuredClone(
      this.allEdges.filter((e) =>
        childNodes.some((n) => n.id === e.source || n.id === e.target)
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
        devPluginDirs: this.devPluginDirs, // 子流程开发版插件目录同步传递
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
    if (this.nodeErrorCount) this.nodeErrorCount[nodeId] = 0

    let nextEdges = (this._outEdges.get(nodeId) || []).filter(
      (edge) => edge.sourceHandle === 'next'
    )

    const node = this._findNode(nodeId)
    if (node?.type === 'workflowIf' && this.nodeOutputs[nodeId]?.result === false) {
      nextEdges = (this._outEdges.get(nodeId) || []).filter(
        (edge) => edge.sourceHandle === 'next-false'
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

    // 重启前同样会执行节点销毁钩子（关闭浏览器/页面），在跑节点被中断属于预期，不上报错误
    this.finalizing = true
    for (const subFlow of this.subFlows.values()) {
      await subFlow.stop()
    }
    this.subFlows.clear()

    await this.executorManager.cleanup()
    // 清理完成后允许新一轮执行正常上报错误
    this.finalizing = false

    clearTimeout(this.completeTimer)
    this.completeTimer = null

    this.executorManager = new ExecutorManager(this)
    this.runningNodeIds.clear()
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
    // 结束流程：先触发各节点销毁钩子（关闭已打开的浏览器）、子流程停止，最后上报终态。
    // 各步独立 try/catch：任一步异常都不能跳过后续销毁钩子或终态上报，否则会"浏览器没关、错误信息丢失"。
    // 置位 finalizing：此后节点因资源释放被中断（Target closed 等）一律视为主动终止，不上报节点错误
    this.finalizing = true
    try {
      for (const subFlow of this.subFlows.values()) {
        await subFlow.stop()
      }
    } catch (e) {
      console.error('清理子流程失败:', e)
    }
    this.subFlows.clear()

    try {
      await this.executorManager.cleanup()
    } catch (e) {
      console.error('清理节点执行器失败:', e)
    }
    clearTimeout(this.completeTimer)
    this.completeTimer = null
    this.runningNodeIds.clear()
    this.errorHandlingCount = 0

    if (!this.isSubFlow) {
      this.allNodes = null
      this.allEdges = null
      this.global = null
    }
    this.nodes = null
    this.edges = null
    this._inEdges = null
    this._outEdges = null
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
