import { EventEmitter } from 'events'
import { sendToRenderer, sendToRendererAsync, onFromRenderer } from '../utils/rendererUtils'
import afs from '../utils/afs'
import { getBrowserDetail } from '@/api/browserDetail.js'
import fs from 'fs'
import path from 'path'
import { is } from '@electron-toolkit/utils'
import { VM } from 'vm2'
import { safeInspectToJSON } from '../utils/safeInspectToJSON'

class NodeExecutor extends EventEmitter {
  constructor(node, context) {
    super()
    if (!node || !node.id || !node.type) {
      throw new Error(`Invalid node data: ${JSON.stringify(node)}`)
    }
    this.node = node //节点
    this.context = context //上下文
    this.state = 'pending' //状态
    this.initialized = false //是否初始化
    this.inputs = {} //输入
    this.executor = null //执行器
    this.nodeEventCleanup = null // 节点事件清理函数
    this.onNodeEventFn = null // 节点事件回调函数
    this.beforeDestroyFns = [] // 用于存储销毁前的回调函数
    this.nodeExecutorTimer = null // 节点执行器定时器
    this.queue = [] // 用于存储节点执行队列
    this.store = {} // 用于存储节点状态
    this.debug = this.context.engine.debug // 是否开启调试模式
  }

  async init() {
    // 如果已经初始化，直接返回
    if (this.initialized) {
      return true
    }
    try {
      this.registerNodeEvent()
      if (is.dev) {
        function convertImportsAndExports(executeStr) {
          // 转换 import 语句，分号可选
          const importRegex =
            /import\s+((?:\{[^}]*\})|[\w*]+)(?:\s+as\s+(\w+))?\s+from\s+['"]([^'"]+)['"]\s*(;?)/g
          executeStr = executeStr.replace(
            importRegex,
            (match, imports, alias, module, semicolon) => {
              if (module.startsWith('@dataModule')) {
                module = './3A6EB0790F39AC87'
              } else if (module.startsWith('@pageEval')) {
                module = './92A5DC04BD6F9FB8'
              } else if (module.startsWith('@/common')) {
                module = './BsXLohN0BsXLohN0'
              }
              if (imports.startsWith('{')) {
                const importList = imports
                  .slice(1, -1)
                  .split(',')
                  .map((item) => item.trim())
                const requireList = importList.map((item) => {
                  const [local, exported] = item.includes(' as ')
                    ? item.split(' as ').map((i) => i.trim())
                    : [item, item]
                  return `const ${local === exported ? local : exported} = require('${module}').${local}${semicolon ? ';' : ''}`
                })
                return requireList.join('\n') + '\n'
              } else if (alias) {
                return `const ${alias} = require('${module}')${semicolon ? ';' : ''}\n`
              } else {
                return `const ${imports} = require('${module}')${semicolon ? ';' : ''}\n`
              }
            }
          )

          // 转换默认导出，分号可选
          const defaultExportRegex = /export\s+default\s+([\w.]+)\s*(;?)/g
          executeStr = executeStr.replace(defaultExportRegex, (match, exported, semicolon) => {
            return `module.exports = ${exported}${semicolon ? ';' : ''}\n`
          })

          // 转换具名导出，分号可选
          const namedExportRegex = /export\s+(\{[^}]*\})\s*(;?)/g
          executeStr = executeStr.replace(namedExportRegex, (match, exports, semicolon) => {
            const exportList = exports
              .slice(1, -1)
              .split(',')
              .map((item) => item.trim())
            const moduleExports = exportList.map((item) => {
              const [local, exported = local] = item.split(' as ')
              return `exports.${exported} = ${local}${semicolon ? ';' : ''}`
            })
            return moduleExports.join('\n') + '\n'
          })

          return executeStr
        }

        //读取执行器字符串
        let executeStr = fs.readFileSync(
          path.join(
            __dirname,
            `../../src/renderer/src/workflow/nodes/${this.node.type}/execute.js`
          ),
          'utf-8'
        )
        //将executeStr中的import语句替换为require格式
        executeStr = convertImportsAndExports(executeStr)
        // 加载节点执行器
        this.executor = eval(executeStr)
      } else {
        // 加载节点执行器
        const execute = await import(`@renderer/workflow/nodes/${this.node.type}/execute.js`)
        this.executor = execute.default
      }
      this.setState('initialized')
      this.initialized = true
      return true
    } catch (error) {
      this.setState('error', error.message)
    }
  }

  registerNodeEvent() {
    // 监听节点事件
    const channel = `flowEventBus:nodeEvent:${this.context.flowId}:${this.node.id}`
    // 注册监听器并保存清理函数
    this.nodeEventCleanup = onFromRenderer(channel, (data) => {
      if (this.onNodeEventFn) {
        this.onNodeEventFn(data)
      }
    })
  }

  // 设置输入
  setInputs(inputs) {
    this.inputs = { ...this.inputs, ...inputs }
  }
  // 获取输入
  getInputs() {
    return this.inputs
  }
  // 获取状态
  getState() {
    return this.state
  }
  // //设置节点执行计时器
  // setExecutionTimer() {
  //   this.clearExecutionTimer()
  //   if (this.node.config?.nodeExecute && this.node.config?.nodeExecuteTimeout) {
  //     this.executionTimer = setTimeout(() => {
  //       this.setState('timeout', '节点执行超时')
  //     }, this.node.config.nodeExecuteTimeout)
  //   }
  // }
  // // 清除节点执行计时器
  // clearExecutionTimer() {
  //   if (this.executionTimer) {
  //     clearTimeout(this.executionTimer)
  //     this.executionTimer = null
  //   }
  // }
  // 执行节点
  async execute() {
    try {
      // 初始化
      await this.init()
      // 加载节点执行器
      if (!this.executor || typeof this.executor !== 'function') {
        throw new Error(`Invalid node module for type: ${this.node.type}`)
      }
      this.node.inputs = this.inputs
      this.node.store = this.store
      if (this.state !== 'running') {
        // 状态改变
        this.setState('running')
        // 设置节点执行计时器
        // this.setExecutionTimer()
        // 执行节点
        await this.executor(this.node, this.createContext())
      } else {
        // 加入队列
        this.queue.push(this.inputs)
      }
    } catch (error) {
      this.setState('error', error.message)
    }
  }
  // 发送调试信息
  sendDebugInfo(state, error = null) {
    if (!this.debug) {
      return
    }
    const date = new Date();
    const timestamp = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + '.' + date.getMilliseconds().toString().padStart(3, '0');
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
    sendToRenderer(`flowEventBus:debug:${this.context.flowId}:${this.node.id}`, debugInfo)
  }
  // 设置状态
  setState(state, error = null, force = false) {
    // 清除节点执行计时器
    // this.clearExecutionTimer()
    this.state = state
    // 发送调试信息
    this.sendDebugInfo(state, error)
    // 如果状态不是running，并且队列中还有数据，则执行队列中的数据
    if (this.state !== 'running' && this.queue.length > 0 && !force) {
      this.inputs = this.queue.pop()
      this.execute()
    }
    // 向工作流引擎发送状态变化事件
    this.emit('stateChange', {
      nodeId: this.node.id,
      state: this.state,
      error: error
    })
    // 发送状态变化事件
    sendToRenderer(`flowEventBus:nodeStatus:${this.context.flowId}:${this.node.id}`, {
      state: this.state,
      error: error
    })
    if (this.state === 'error') {
      throw new Error(`${this.node.name}: ${error}`)
    }
  }

  //验证输出
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

  //下一步
  async next() {
    if (!this.context?.engine) {
      return
    }
    // 如果工作流状态不为运行中，直接返回
    if (this.context.engine.state !== 'running') {
      return
    }
    const noOutputFields = this.validateOutputs()
    if (noOutputFields.length > 0) {
      this.setState('error', `输出验证失败: ${noOutputFields.join(',')}`)
      return
    }
    await this.context.engine.next(this.node.id)
  }

  // 设置输出
  setOutputs(outputs) {
    if (!this.context?.engine) {
      return
    }
    this.context.engine.setOutputs(this.node.id, outputs)
  }

  // 获取输出
  getOutputs() {
    if (!this.context?.engine) {
      return {}
    }
    return this.context.engine.getOutputs(this.node.id) || {}
  }

  // 创建上下文
  createContext() {
    return {
      ...this.context,
      nodeId: this.node.id,
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      fs: new afs(),
      global: this.context.engine.global,
      getOutputs: () => {
        return this.getOutputs()
      },
      setOutputs: (outputs) => {
        this.setOutputs(outputs)
      },
      //执行下一个节点
      next: async (outputs) => {
        if (outputs) {
          this.setOutputs(outputs)
        }
        // 发送调试信息
        this.sendDebugInfo('next')
        await this.next()
      },
      // 执行子流程
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
      // 发送消息到渲染进程
      sendNodeEvent: async (params) => {
        const channel = `flowEventBus:nodeEvent:${this.context.flowId}:${this.node.id}`
        if (params.async) {
          return await sendToRendererAsync(channel, params)
        } else {
          sendToRenderer(channel, params)
        }
      },
      // 监听来自渲染进程的事件
      onNodeEvent: (callback) => {
        this.onNodeEventFn = callback
      },
      // 注册节点销毁前的回调
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
      //重启工作流
      retryFlow: async () => {
        if (!this.context?.engine) {
          return
        }
        await this.context.engine.retryFlow()
      },
      // 执行代码
      runCode: (code, context = {}) => {
        context.data = JSON.stringify(context.data || '')
        const vm = new VM({
          sandbox: { ...context, setTimeout, require: undefined, import: undefined },
          eval: false,
          wasm: false,
          fixAsync: false,
          contextify: true, // 启用上下文隔离
          // 严格限制 Node 模块访问
          require: {
            external: false, // 禁止加载外部模块
            builtin: [] // 禁止加载内置模块
          }
        })
        return vm.run(`data = JSON.parse(data);${code}`)
      },
      apis: {
        getBrowserDetail
      }, sendToRenderer
    }
  }

  // 执行销毁前的回调
  async executeBeforeDestroy() {
    try {
      // 按注册顺序执行所有销毁前的回调
      for (const fn of this.beforeDestroyFns) {
        await fn()
      }
    } catch (error) {
      console.error(`Error executing before destroy callbacks for node ${this.node.id}:`, error)
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
      }

      this.removeAllListeners()

      sendToRenderer(`flowEventBus:nodeStatus:${this.context.flowId}:${this.node.id}`, {
        state: 'stopped',
        error: null
      })
      this.node = null
      this.context = null
    } catch (error) {
      console.error(`Error during cleanup for node ${this.node.id}:`, error)
    }
  }
}

export default NodeExecutor
