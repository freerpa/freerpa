/**
 * @file: 工作流执行入口 — deno worker 模式
 * 引擎在 deno 宿主进程内的工作流 Worker 中执行（每个工作流一个 Worker，子工作流统一域）
 */
import EngineHost from './host/index.js'
import { buildDenoPermissions, getPermissions } from './permissions.js'
import { register } from './ipc.js'

const MAX_RUNNING = 999

/** 基础设施读路径（引擎/节点/依赖，自动授予 worker） */
const infraReadPaths = (host) => [
  host.paths.workerRoot,
  host.paths.nodesRoot,
  host.paths.dataHandlersRoot,
  host.paths.nodeModulesRoot
]

export const manager = {
  /** 创建工作流引擎（宿主内为 flowId 创建独立 Worker，并按权限规则生成最小权限描述符） */
  createEngine: async (workflow) => {
    if (!workflow?.id || !Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) {
      throw new Error('工作流数据不完整')
    }
    if (EngineHost.runningFlows.size >= MAX_RUNNING) {
      throw new Error(`同时运行的工作流数量超过限制：${MAX_RUNNING} 个`)
    }
    const flowId = workflow.id
    const effective = getPermissions()

    // 1. 创建 Worker（deno.permissions 描述符按生效权限生成）
    await EngineHost.createWorker(flowId, buildDenoPermissions(effective, infraReadPaths(EngineHost)))
    // 2. 初始化 Worker（节点目录 / io roots）
    await EngineHost.invoke('init', {
      flowId,
      nodesRoot: EngineHost.paths.nodesRoot,
      ioRoots: effective.io.roots
    }, flowId)
    // 3. 创建工作流引擎
    await EngineHost.invoke('createEngine', { workflow }, flowId)
    return true
  },

  /** 执行工作流（结果与状态事件经宿主事件通道回传） */
  startFlow: async (flowId) => {
    return await EngineHost.invoke('startFlow', {}, flowId)
  },

  /** 停止工作流 */
  stopFlow: async (flowId) => {
    return await EngineHost.invoke('stopFlow', {}, flowId)
  },

  /** 清理（保留宿主进程，后续自动复用） */
  cleanup: async () => {
    EngineHost.runningFlows.clear()
  },

  getRunningWorkflowCount: () => EngineHost.runningFlows.size
}

// 注册 IPC 处理
export const registerIPC = async () => {
  register()
}
