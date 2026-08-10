/**
 * @file: AI 工具总入口
 * buildTools(ctx)   → OpenAI 风格工具定义数组（传给主进程转换为 AI SDK ToolSet）
 * buildExecutors(ctx) → { toolName: (args) => string } 执行器（renderer 执行，返回文本）
 * ctx: { vueFlowRef, flowRef, workflowId, flowStore }
 */
import { createWorkflowTools, createWorkflowExecutors } from './workflow.js'
import { createBrowserTools, createBrowserExecutors } from './browser.js'
import { createDataTableTools, createDataTableExecutors } from './dataTable.js'
import { createElementSetTools, createElementSetExecutors } from './elementSet.js'

export const buildTools = (ctx) => [
  ...createWorkflowTools(),
  ...createBrowserTools(ctx),
  ...createDataTableTools(ctx),
  ...createElementSetTools(ctx)
]

export const buildExecutors = (ctx) => ({
  ...createWorkflowExecutors(ctx),
  ...createBrowserExecutors(ctx),
  ...createDataTableExecutors(ctx),
  ...createElementSetExecutors(ctx)
})
