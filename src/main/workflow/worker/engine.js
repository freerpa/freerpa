/**
 * @file: 工作流 Worker 入口（每个工作流一个实例；子工作流在父 Worker 内统一域执行）
 * 命令由宿主转发：init → createEngine → startFlow / stopFlow / emitNodeEvent
 */
import { bridge } from './bridge.js'
import WorkflowManager from './core/WorkflowManager.js'
import { setNodesRoot } from './core/nodeLoader.js'

let flowId = null
let ioRoots = []
let pluginRoots = []
let devPluginDirs = []
let networkServerPort = 0

// 初始化：宿主创建 Worker 后第一个命令（注入工作流配置）
bridge.onInvoke('init', ({ flowId: fid, nodesRoot, ioRoots: roots, pluginRoots: proots, devPluginDirs: devDirs = [], networkServerPort: nsp = 0 }) => {
  flowId = fid
  ioRoots = roots || []
  pluginRoots = proots || []
  devPluginDirs = devDirs || []
  // ?? 而非 ||：isolated 实例注入 0 表示由 OS 分配随机端口，不能被折叠成默认值
  networkServerPort = nsp ?? 0
  setNodesRoot(nodesRoot)
  return true
})

// 创建工作流引擎
bridge.onInvoke('createEngine', async ({ workflow }) => {
  flowId = workflow.id
  const engine = await WorkflowManager.createEngine({ ...workflow, ioRoots, pluginRoots, devPluginDirs, networkServerPort })
  engine.on('stateChange', (state, error) => {
    // Error 对象跨 worker→宿主→主进程→渲染进程结构化克隆不可靠，统一归一为可读字符串
    bridge.sendEvent(`flowEventBus:stateChange:${flowId}`, {
      state,
      error: error ? error.message || String(error) : null
    })
    if (['completed', 'stopped', 'error'].includes(state)) {
      engine.removeAllListeners()
      WorkflowManager.removeEngine(flowId)
    }
  })
  return { success: true }
})

// 执行工作流
bridge.onInvoke('startFlow', async () => {
  const engine = WorkflowManager.getEngine(flowId)
  if (!engine) throw new Error(`工作流不存在: ${flowId}`)
  const result = await engine.execute()
  return { success: true, ...result }
})

// 停止工作流
bridge.onInvoke('stopFlow', async () => {
  const engine = WorkflowManager.getEngine(flowId)
  if (engine) {
    await engine.stop()
    WorkflowManager.removeEngine(flowId)
  }
  return { success: true }
})

// 渲染进程 → 节点事件（sendNodeEvent 的 onNodeEvent / async 响应）
bridge.onInvoke('emitNodeEvent', async ({ channel, payload }) => {
  bridge.emit(channel, payload)
  return null
})

// 通知宿主本 worker 已就绪
self.postMessage({ type: 'ready' })
