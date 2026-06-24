import WorkflowManager from './core/manger/WorkflowManager'
import WorkflowExecutor from './core/executor/WorkflowExecutor'
import { register } from './ipc'

// 导出工作流执行器单例
export const manager = WorkflowManager

// 导出工作流引擎类
export const executor = WorkflowExecutor

// 注册 IPC 处理
export const registerIPC = async () => {
  register()
}
