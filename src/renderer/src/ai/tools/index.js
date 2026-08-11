/**
 * @file: AI 工具总入口
 * buildTools(ctx)   → OpenAI 风格工具定义数组（传给主进程转换为 AI SDK ToolSet）
 * buildExecutors(ctx) → { toolName: (args) => string } 执行器（renderer 执行，返回文本）
 * toolGroupOf(name) → 工具所属模块标签（兜底展示；从工具定义动态推导）
 * toolDisplayName(tc) → 工具卡片显示名（动作 + 对象，如「查看节点：HTTP请求」）
 * ctx: { vueFlowRef, flowRef, workflowId, flowStore }
 */
import nodes from '@nodes-path'
import { createWorkflowTools, createWorkflowExecutors } from './workflow.js'
import { createBrowserTools, createBrowserExecutors } from './browser.js'
import { createDataTableTools, createDataTableExecutors } from './dataTable.js'
import { createElementSetTools, createElementSetExecutors } from './elementSet.js'

/** 工具 → 模块分组（顺序即标签优先级；从 createXxxTools 定义推导，避免硬编码工具名列表） */
const TOOL_GROUPS = [
  { label: '工作流引擎', tools: createWorkflowTools() },
  { label: '浏览器', tools: createBrowserTools() },
  { label: '数据表', tools: createDataTableTools() },
  { label: '元素集', tools: createElementSetTools() }
]

/** 工具名 → 模块标签（未知工具回退「工作流引擎」，与旧硬编码默认一致） */
export const toolGroupOf = (name = '') => {
  if (!name) return '未知工具'
  const group = TOOL_GROUPS.find((g) => g.tools.some((t) => t.function.name === name))
  return group ? group.label : '工作流引擎'
}

/** 工具名 → 可读动作（工具卡片头部展示，替代原始英文名） */
const TOOL_LABELS = {
  // 工作流
  listNodeTypes: '查看节点类型',
  getNodeConfig: '查看节点',
  addNode: '创建节点',
  connect: '连接节点',
  updateNode: '更新节点',
  deleteNode: '删除节点',
  deleteEdge: '删除连线',
  getWorkflows: '查看工作流列表',
  getWorkflow: '查看工作流',
  finish: '完成任务',
  // 浏览器
  createBrowser: '创建浏览器',
  openBrowser: '打开浏览器',
  closeBrowser: '关闭浏览器',
  getAllBrowserStatus: '查看浏览器状态',
  getKernelList: '查看内核列表',
  getMajorVersionList: '查看内核版本',
  checkKernel: '检查内核',
  downloadKernel: '下载内核',
  // 数据表
  listTables: '查看数据表列表',
  getTable: '查看数据表',
  createTable: '创建数据表',
  deleteTable: '删除数据表',
  queryData: '查询数据',
  createData: '新增数据',
  updateData: '更新数据',
  deleteData: '删除数据',
  // 元素集
  createElementSet: '创建元素集',
  listElementSets: '查看元素集列表',
  getElementSet: '查看元素集'
}

/** 参数对象 → 可读对象名（节点类型参数解析为节点名，如 getNodeConfig/addNode 的 type） */
const objectOf = (name, args = {}) => {
  if (args?.type && nodes[args.type]) return nodes[args.type].name || args.type
  return null
}

/**
 * 工具卡片显示名：动作 + 对象（如「查看节点：HTTP请求」），替代模块级标签；
 * 参数中带节点类型（type）时附上节点中文名，让模型操作对象一目了然。
 */
export const toolDisplayName = (tc) => {
  const name = tc?.function?.name || tc?.name || tc?.toolName || ''
  if (!name) return '未知工具'
  const label = TOOL_LABELS[name] || toolGroupOf(name)
  let args = tc?.function?.arguments ?? tc?.arguments ?? tc?.args
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch {
      args = null
    }
  }
  const obj = objectOf(name, args)
  return obj ? `${label}：${obj}` : label
}

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
