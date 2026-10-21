/**
 * @file: MCP 工作流工具（存储 CRUD + 执行控制）
 *
 * 执行相关工具不直接驱动 deno worker：工作流执行需要节点定义、参数引用解析、动态 IO 重建，
 * 这些能力只存在于渲染进程。因此执行工具经 IPC 委托渲染端 MCP 执行器（src/renderer/src/mcp），
 * 主进程只维护运行台账（runs.js）。
 */
import {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getTrashWorkflows,
  restoreWorkflow,
  permanentDeleteWorkflow,
} from '../../data/workflows/index.js';
import { createRun, getRun, listRuns, waitRun, stopRun } from '../runs.js';
import { defineTool } from '../registry.js';

const graphSchema = {
  type: 'object',
  description: '工作流图数据（Vue Flow 序列化结构）',
  properties: {
    nodes: { type: 'array', description: '节点数组（含 id/type/position/data）' },
    edges: { type: 'array', description: '连线数组（含 id/source/target/sourceHandle/targetHandle）' },
  },
  required: ['nodes', 'edges'],
  additionalProperties: true,
};

/** graph 可能是数据库中的 JSON 字符串，统一成对象（避免二次编码） */
const normalizeGraph = (graph) => {
  if (!graph) return { nodes: [], edges: [] };
  if (typeof graph === 'string') {
    try {
      return JSON.parse(graph);
    } catch {
      throw new Error('graph 不是合法的 JSON');
    }
  }
  return graph;
};

/** 图数据约束：同一父流程（主流程或同一子流程容器）内只允许一个开始节点 */
const assertSingleStartPerFlow = (graph) => {
  const seen = new Set();
  for (const node of graph?.nodes || []) {
    if ((node?.data?.type || node?.type) !== 'workflowStart') continue;
    const parent = node?.parentNode || '';
    if (seen.has(parent)) {
      throw new Error('图数据不合法：同一流程内只允许一个开始流程节点（workflowStart），请删除多余节点后重试');
    }
    seen.add(parent);
  }
};

export const registerWorkflowTools = () => {
  defineTool({
    name: 'workflow_list',
    title: '工作流列表',
    description:
      '分页查询工作流（不含回收站）。返回 id/name/description/category_id/时间等元信息，可用 keyword 按名称或描述模糊搜索。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '名称/描述关键词' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
      },
    },
    annotations: { readOnlyHint: true },
    handler: async ({ keyword = '', page = 1, pageSize = 20 }) => {
      const result = await getWorkflows({ keyword, page, pageSize });
      // 列表不返回 graph（可能非常大），需要图结构请用 workflow_get_graph
      const data = (result?.data || []).map((item) => {
        const row = { ...item };
        delete row.graph;
        return row;
      });
      return { ...result, data };
    },
  });

  defineTool({
    name: 'workflow_get',
    title: '工作流详情',
    description:
      '按 id 获取工作流元信息。默认不返回 graph（图可能很大），需要图结构请设 includeGraph=true 或使用 workflow_get_graph。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '工作流 id' },
        includeGraph: { type: 'boolean', default: false, description: '是否返回完整图数据' },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ id, includeGraph = false }) => {
      const workflow = await getWorkflow(id);
      if (!workflow) throw new Error(`工作流不存在：${id}`);
      if (!includeGraph) {
        let nodeCount = 0;
        let edgeCount = 0;
        try {
          const graph = normalizeGraph(workflow.graph);
          nodeCount = graph.nodes?.length || 0;
          edgeCount = graph.edges?.length || 0;
        } catch {
          /* 损坏的 graph 不影响元信息查询 */
        }
        delete workflow.graph;
        return { ...workflow, nodeCount, edgeCount };
      }
      return { ...workflow, graph: normalizeGraph(workflow.graph) };
    },
  });

  defineTool({
    name: 'workflow_get_graph',
    title: '获取工作流图',
    description:
      '获取工作流的完整图数据（nodes/edges）。节点数据结构：{ id, type, position, data: { name, type, version, config, deactivate, inputs, outputs } }。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: '工作流 id' } },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ id }) => {
      const workflow = await getWorkflow(id);
      if (!workflow) throw new Error(`工作流不存在：${id}`);
      return { id, name: workflow.name, graph: normalizeGraph(workflow.graph) };
    },
  });

  defineTool({
    name: 'workflow_create',
    title: '创建工作流',
    description:
      '创建工作流。graph 可省略（创建空工作流）；开始流程节点（workflowStart）由客户端在打开画布时自动创建，无需手动写入。后续可用 workflow_update 写入节点/连线。返回新工作流 id。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '工作流名称' },
        description: { type: 'string' },
        category_id: { type: 'string', description: '分类 id（可用 category_list 查询）' },
        graph: graphSchema,
      },
      required: ['name'],
    },
    handler: async ({ name, description = '', category_id = '', graph }) => {
      const graphData = normalizeGraph(graph);
      assertSingleStartPerFlow(graphData);
      const id = await createWorkflow({
        name,
        description,
        category_id,
        graph: graphData,
      });
      return { id, name };
    },
  });

  defineTool({
    name: 'workflow_update',
    title: '更新工作流',
    description:
      '更新工作流元信息或图数据（只传需要修改的字段）。⚠ 写入 graph 会整体覆盖现有图，建议先 workflow_get_graph 取出再改。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        category_id: { type: 'string' },
        graph: graphSchema,
      },
      required: ['id'],
    },
    handler: async (payload) => {
      const existing = await getWorkflow(payload.id);
      if (!existing) throw new Error(`工作流不存在：${payload.id}`);
      const next = { ...payload };
      if (payload.graph) {
        next.graph = normalizeGraph(payload.graph);
        assertSingleStartPerFlow(next.graph);
      }
      await updateWorkflow(next);
      return { success: true, id: payload.id };
    },
  });

  defineTool({
    name: 'workflow_delete',
    title: '删除工作流（移入回收站）',
    description: '将工作流移入回收站（软删除，可恢复）。需要 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        confirm: { type: 'boolean', description: '必须为 true，确认删除' },
      },
      required: ['id', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ id }) => {
      await deleteWorkflow(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'workflow_restore',
    title: '恢复工作流',
    description: '从回收站恢复工作流。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      await restoreWorkflow(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'workflow_permanent_delete',
    title: '彻底删除工作流',
    description: '从回收站彻底删除，不可恢复。需要 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['id', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ id }) => {
      await permanentDeleteWorkflow(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'workflow_trash_list',
    title: '回收站工作流',
    description: '列出回收站中的工作流。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => getTrashWorkflows(),
  });

  // ─── 执行控制 ─────────────────────────────────────────

  defineTool({
    name: 'workflow_run',
    title: '执行工作流',
    description:
      '异步启动一个工作流实例，立即返回 runId（执行不阻塞）。用 workflow_run_status 查询进度，workflow_run_wait 等待完成，workflow_run_stop 停止。同一工作流可并发多次执行。',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: '工作流 id' },
        debug: { type: 'boolean', default: false, description: '开启调试模式（采集节点调试信息）' },
      },
      required: ['workflowId'],
    },
    handler: async ({ workflowId, debug = false }) => {
      const workflow = await getWorkflow(workflowId);
      if (!workflow) throw new Error(`工作流不存在：${workflowId}`);
      return createRun({ workflowId, debug });
    },
  });

  defineTool({
    name: 'workflow_run_status',
    title: '查询运行状态',
    description:
      '按 runId 查询运行状态：starting（启动中）/ running（运行中）/ completed（完成）/ stopped（已停止）/ error（失败），含错误信息与耗时。',
    inputSchema: {
      type: 'object',
      properties: { runId: { type: 'string' } },
      required: ['runId'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ runId }) => {
      const run = getRun(runId);
      if (!run) throw new Error(`运行实例不存在：${runId}`);
      return run;
    },
  });

  defineTool({
    name: 'workflow_run_wait',
    title: '等待运行结束',
    description:
      '阻塞等待实例到达终态（completed/stopped/error）或超时。超时返回当前状态而非报错，可继续轮询。默认等待 60 秒，最长 600 秒。',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        timeoutSec: { type: 'integer', minimum: 1, maximum: 600, default: 60 },
      },
      required: ['runId'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ runId, timeoutSec = 60 }) => {
      const run = await waitRun(runId, timeoutSec * 1000);
      if (!run) throw new Error(`运行实例不存在：${runId}`);
      return run;
    },
  });

  defineTool({
    name: 'workflow_run_stop',
    title: '停止运行',
    description: '停止指定实例（会执行节点销毁钩子并释放浏览器资源）。需 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['runId', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ runId }) => {
      const run = await stopRun(runId);
      if (!run) throw new Error(`运行实例不存在：${runId}`);
      return run;
    },
  });

  defineTool({
    name: 'workflow_run_list',
    title: '运行实例列表',
    description: '列出最近创建的运行实例（最多 100 条），可按状态过滤。',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['starting', 'running', 'completed', 'stopped', 'error'],
        },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
    },
    annotations: { readOnlyHint: true },
    handler: async ({ status, limit = 20 }) => listRuns({ status, limit }),
  });
};
