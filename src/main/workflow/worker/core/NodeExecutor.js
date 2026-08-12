import { EventEmitter } from 'node:events'
import { bridge } from '../bridge.js'
import { loadNodeExecutor } from './nodeLoader.js'
import afs from './afs.js'
import { safeInspectToJSON } from './safeInspectToJSON.js'

class NodeExecutor extends EventEmitter {
  constructor(node, context) {
    super()
    if (!node || !node.id || !node.type) {
      throw new Error(`Invalid node data: ${JSON.stringify(node)}`)
    }
    this.node = node // 节点
    this.context = context // 上下文
    this.state = 'pending' // 状态
    this.initialized = false // 是否初始化
    this.inputs = {} // 输入
    this.executor = null // 执行器
    this.nodeEventCleanup = null // 节点事件清理函数
    this.onNodeEventFn = null // 节点事件回调函数
    this.beforeDestroyFns = [] // 销毁前回调
    this.queue = [] // 节点执行队列
    this.store = {} // 节点状态存储
    this.debug = this.context.engine.debug // 调试模式
  }

  async init() {
    if (this.initialized) {
      return true
    }
    try {
      this.registerNodeEvent()
      // 加载节点执行器（dev/prod 一致：动态 import 节点文件）
      this.executor = await loadNodeExecutor(this.node.type, this.node.version)
      this.setState('initialized')
      this.initialized = true
      return true
    } catch (error) {
      // 失败：标记 error 后向上抛出，由 execute() 统一处理（避免重复 setState('error')）
      this.setState('error', error.message)
      throw error
    }
  }

  registerNodeEvent() {
    // 通知主进程注册 ipcMain.handle（渲染进程 invoke → 转发本 worker）
    const channel = `flowEventBus:nodeEvent:${this.context.flowId}:${this.node.id}`
    bridge.rpc('engine.registerNodeEvent', channel).catch(() => {})
    this.nodeEventCleanup = bridge.on(channel, (data) => {
      if (this.onNodeEventFn) {
        this.onNodeEventFn(data)
      }
    })
  }

  setInputs(inputs) {
    this.inputs = { ...this.inputs, ...inputs }
  }

  async execute() {
    try {
      await this.init()
      if (!this.executor || typeof this.executor !== 'function') {
        throw new Error(`Invalid node module for type: ${this.node.type}`)
      }
      if (this.state === 'error') {
        throw new Error(`${this.node.name}: ${this.errorMessage || '初始化失败'}`)
      }
      this.node.inputs = this.inputs
      this.node.store = this.store
      if (this.state !== 'running') {
        this.setState('running')
        await this.executor(this.node, this.createContext())
      } else {
        this.queue.push(this.inputs)
      }
    } catch (error) {
      // 已标记 error（init/executor 内部 setState）则不重复触发；统一向上抛出供 WorkflowExecutor 决策
      if (this.state !== 'error') {
        this.setState('error', error.message)
      }
      throw error
    }
  }

  // 发送调试信息到渲染进程
  sendDebugInfo(state, error = null) {
    if (!this.debug) {
      return
    }
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 23)
    const debugInfo = {
      nodeId: this.node.id,
      state: state,
      store: safeInspectToJSON(this.store),
      config: safeInspectToJSON(this.node.config),
      inputs: safeInspectToJSON(this.inputs),
      outputs: safeInspectToJSON(this.getOutputs()),
      error: error,
      timestamp: timestamp
    }
    bridge.sendEvent(`flowEventBus:debug:${this.context.flowId}:${this.node.id}`, debugInfo)
  }

  setState(state, error = null, force = false) {
    this.state = state
    this.sendDebugInfo(state, error)
    // 状态非 running 且队列非空 → 继续执行队列
    if (this.state !== 'running' && this.queue.length > 0 && !force) {
      this.inputs = this.queue.pop()
      this.execute()
    }
    this.emit('stateChange', {
      nodeId: this.node.id,
      state: this.state,
      error: error
    })
    bridge.sendEvent(`flowEventBus:nodeStatus:${this.context.flowId}:${this.node.id}`, {
      state: this.state,
      error: error
    })
    // 记录错误信息（供 execute() 短路抛出；error 状态不再在此 throw，避免同一错误触发两次 error 事件）
    if (this.state === 'error') {
      this.errorMessage = error
    }
  }

  validateOutputs() {
    const outputsData = this.context.engine.getOutputs(this.node.id) || {}
    const outputs = this.node?.outputs || []
    let noOutputFields = []
    outputs.forEach((output) => {
      if (!Object.prototype.hasOwnProperty.call(outputsData, output.id)) {
        noOutputFields.push(output.name)
      }
    })
    return noOutputFields
  }

  async next() {
    if (!this.context?.engine || this.context.engine.state !== 'running') {
      return
    }
    const noOutputFields = this.validateOutputs()
    if (noOutputFields.length > 0) {
      this.setState('error', `输出验证失败: ${noOutputFields.join(',')}`)
      return
    }
    await this.context.engine.next(this.node.id)
  }

  setOutputs(outputs) {
    if (!this.context?.engine) {
      return
    }
    this.context.engine.setOutputs(this.node.id, outputs)
  }

  getOutputs() {
    if (!this.context?.engine) {
      return {}
    }
    return this.context.engine.getOutputs(this.node.id) || {}
  }

  createContext() {
    return {
      ...this.context,
      nodeId: this.node.id,
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      fs: new afs(this.context.engine.ioRoots),
      global: this.context.engine.global,
      getOutputs: () => this.getOutputs(),
      setOutputs: (outputs) => this.setOutputs(outputs),
      // 执行下一个节点
      next: async (outputs) => {
        if (outputs) {
          this.setOutputs(outputs)
        }
        this.sendDebugInfo('next')
        await this.next()
      },
      // 执行子流程（统一域：在父 Worker 内继续，不新建 Worker）
      executeSubFlow: async (inputs) => {
        if (!this.context?.engine) {
          return
        }
        return await this.context.engine.executeSubFlow(this.node.id, inputs)
      },
      // 完成节点执行
      complete: async (outputs, isNext = true) => {
        if (outputs) {
          this.setOutputs(outputs)
        }
        this.setState('success')
        if (isNext) {
          await this.next()
        }
      },
      // 发送消息到渲染进程（经 IPC 注入）
      sendNodeEvent: async (params) => {
        const channel = `flowEventBus:nodeEvent:${this.context.flowId}:${this.node.id}`
        if (params.async) {
          return await bridge.rpc('sendToRendererAsync', channel, params)
        } else {
          bridge.sendEvent(channel, params)
        }
      },
      // 监听来自渲染进程的事件
      onNodeEvent: (callback) => {
        this.onNodeEventFn = callback
      },
      // 注册节点销毁前回调
      onBeforeDestroy: (callback) => {
        if (typeof callback === 'function') {
          this.beforeDestroyFns.push(callback)
        }
      },
      // 停止工作流
      stopWorkflow: async (outputs) => {
        if (!this.context?.engine) {
          return
        }
        if (outputs) {
          this.setOutputs(outputs)
        }
        this.setState('stopped')
        await this.context.engine.stop(outputs)
      },
      // 重启工作流
      retryFlow: async () => {
        if (!this.context?.engine) {
          return
        }
        await this.context.engine.retryFlow()
      },
      apis: {
        getBrowserDetail: (id) => bridge.rpc('getBrowserDetail', id)
      },
      sendToRenderer: (channel, data) => bridge.sendEvent(channel, data)
    }
  }

  async executeBeforeDestroy() {
    for (const fn of this.beforeDestroyFns) {
      try {
        await fn()
      } catch (error) {
        console.error(`Error executing before destroy callbacks for node ${this.node.id}:`, error)
      }
    }
  }

  async cleanup() {
    try {
      this.initialized = false
      this.inputs = null
      this.executor = null
      this.store = null
      this.queue = null

      await this.executeBeforeDestroy()
      this.beforeDestroyFns = null

      if (this.nodeEventCleanup) {
        this.nodeEventCleanup()
        bridge.rpc('engine.unregisterNodeEvent', `flowEventBus:nodeEvent:${this.context.flowId}:${this.node.id}`).catch(() => {})
      }

      this.removeAllListeners()

      bridge.sendEvent(`flowEventBus:nodeStatus:${this.context.flowId}:${this.node.id}`, {
        state: 'stopped',
        error: null
      })
      this.node = null
      this.context = null
    } catch (error) {
      console.error(`Error during cleanup for node ${this.node?.id}:`, error)
    }
  }
}

export default NodeExecutor
