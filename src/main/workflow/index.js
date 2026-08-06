/**
 * @file: 工作流执行入口 — deno worker 模式
 * 引擎在 deno 宿主进程内的工作流 Worker 中执行（每个工作流一个 Worker，子工作流统一域）
 */
import EngineHost from './host/index.js'
import { buildDenoPermissions, getPermissions } from './permissions.js'
import { getPluginDirs } from '../plugin/store.js'
import { clearFlowBrowsers } from './host/rpc-handlers.js'

// 同时运行工作流数量上限。
// ⚠ 与 worker 侧 src/main/workflow/worker/core/WorkflowManager.js 的 WORKFLOW_LIMIT 保持一致（跨进程无法共享常量）
const MAX_RUNNING = 999

/** 基础设施读路径（引擎/节点/依赖/插件目录，自动授予 worker） */
const infraReadPaths = (host, pluginRoots = []) => [
  host.paths.workerRoot,
  host.paths.nodesRoot,
  host.paths.dataHandlersRoot,
  host.paths.nodeModulesRoot,
  ...pluginRoots // 插件目录：插件 execute.js 及其依赖需可读
]

/**
 * 主进程工作流执行门面：
 *  - createEngine：编排（数据校验 → 并发上限 → 创建 Worker → init 注入 → 创建引擎），权限组装见 permissions.js
 *  - startFlow / stopFlow：EngineHost.invoke 的薄透传（真正的执行在 deno worker 内）
 *  - cleanup：销毁全部工作流 Worker 并清理浏览器归属记录（保留宿主进程，后续自动复用）
 */
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
    // 插件目录随 init 注入 worker（同 nodesRoot 机制），并自动并入读权限白名单
    const pluginRoots = getPluginDirs()

    // 1. 创建 Worker（deno.permissions 描述符按生效权限生成）
    await EngineHost.createWorker(flowId, buildDenoPermissions(effective, infraReadPaths(EngineHost, pluginRoots)))
    // 2. 初始化 Worker（节点目录 / io roots / 插件目录）
    await EngineHost.invoke('init', {
      flowId,
      nodesRoot: EngineHost.paths.nodesRoot,
      ioRoots: effective.io.roots,
      pluginRoots
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

  /** 清理：销毁全部工作流 Worker + 清理浏览器归属记录（保留宿主进程，后续自动复用） */
  cleanup: async () => {
    for (const flowId of EngineHost.runningFlows) {
      clearFlowBrowsers(flowId)
    }
    EngineHost.runningFlows.clear()
    try {
      await EngineHost.invoke('destroyAll', {}, null)
    } catch {
      /* 宿主未启动/已退出 */
    }
  }
}
