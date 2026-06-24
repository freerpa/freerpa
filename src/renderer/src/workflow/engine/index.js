import { WorkflowEngine } from './WorkflowEngine'

// 创建工作流引擎实例
export function createWorkflowEngine(elements, workflowId) {
  const engine = new WorkflowEngine(elements, workflowId)
  return engine
}

export { WorkflowEngine } 