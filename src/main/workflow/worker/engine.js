/**
 * @file: 工作流 Worker 入口（每个工作流一个实例；子工作流在父 Worker 内统一域执行）
 * 命令由宿主转发：init → createEngine → startFlow / stopFlow / emitNodeEvent
 */
import { bridge } from './bridge.js'
import WorkflowManager from './core/WorkflowManager.js'
import { setNodesRoot } from './core/nodeLoader.js'

let flowId = null
let ioRoots = []

// 初始化：宿主创建 Worker 后第一个命令（注入工作流配置）
bridge.onInvoke('init', ({ flowId: fid, nodesRoot, ioRoots: roots }) => {
  flowId = fid
  ioRoots = roots || []
  setNodesRoot(nodesRoot)
  return true
})

// 创建工作流引擎
bridge.onInvoke('createEngine', async ({ workflow }) => {
  flowId = workflow.id
  const engine = await WorkflowManager.createEngine({ ...workflow, ioRoots })
  engine.on('stateChange', (state, error) => {
    bridge.sendEvent(`flowEventBus:stateChange:${flowId}`, { state, error })
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
