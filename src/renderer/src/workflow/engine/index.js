import { WorkflowEngine } from './WorkflowEngine'

// 创建工作流引擎实例（workflowId 对应一个 Pinia 动态 store）
export function createWorkflowEngine(workflowId) {
  return new WorkflowEngine(workflowId)
}
