/**
 * @file: MCP Agent 工具桥（复用渲染进程现有 Agent 工具）
 *
 * 客户端内置 AI Agent 已有一套意图级工具（节点增删改连、数据表、元素集、浏览器等），
 * 它们的执行依赖画布状态（vueFlowRef）与节点定义，只能运行在渲染进程。
 * 这里把外部 MCP 调用转交给渲染端 mcp 执行器，避免重复实现一套节点编辑逻辑。
 */
import { sendToRendererAsync } from '../../workflow/host/rendererUtils.js';
import { defineTool } from '../registry.js';

/**
 * 委托渲染端执行并解包 { ok, data|error }（preload 的 mcp.onExec 约定）
 * 注意：sendToRendererAsync 本身只在超时/通道异常时 reject，业务失败需在此转换。
 */
const callRenderer = async (payload) => {
  const response = await sendToRendererAsync('mcp:exec', payload);
  if (response?.ok === false) throw new Error(response.error || '渲染端执行失败');
  return response?.data;
};

export const registerAgentTools = () => {
  defineTool({
    name: 'agent_tools_list',
    title: 'Agent 工具清单',
    description:
      '列出节点级编辑工具（getNodeConfig / addNode / connect / updateNode / deleteNode / deleteEdge）及其 JSON Schema。浏览器、数据表、元素集、工作流查询请直接使用对应的原生 MCP 工具，不要再通过 agent_tool_call 调用。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => {
      const tools = await callRenderer({ op: 'agent.toolsList' });
      return { tools };
    },
  });

  defineTool({
    name: 'agent_tool_call',
    title: '调用 Agent 工具',
    description:
      '在指定工作流上执行内置 Agent 工具（工具名与参数见 agent_tools_list）。两种用法：① 单次调用：tool + arguments；② 批量调用：calls: [{ tool, arguments }, ...] 顺序执行，只打开一次画布，创建多个节点时比逐次调用快得多（推荐）。注意：workflowStart（开始流程）由系统自动创建，禁止手动添加，传入会直接返回已有节点。',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: '目标工作流 id' },
        tool: { type: 'string', description: 'Agent 工具名，如 addNode / connect / updateNode' },
        arguments: { type: 'object', additionalProperties: true, description: '工具参数' },
        calls: {
          type: 'array',
          description: '批量操作列表（与 tool/arguments 二选一），按顺序执行',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', description: 'Agent 工具名' },
              arguments: { type: 'object', additionalProperties: true, description: '工具参数' },
            },
            required: ['tool'],
          },
        },
        stopOnError: { type: 'boolean', default: true, description: '批量模式下遇错是否停止后续操作' },
      },
      required: ['workflowId'],
    },
    handler: async ({ workflowId, tool, arguments: args = {}, calls, stopOnError = true }) => {
      // 批量模式下不要求 tool 字段，但至少要有一种调用方式
      if (!Array.isArray(calls) && !tool) throw new Error('缺少 tool（或使用 calls 批量执行）');
      const result = await callRenderer({
        op: 'agent.toolCall',
        workflowId,
        tool,
        arguments: args,
        calls,
        stopOnError,
      });
      return result;
    },
  });

  defineTool({
    name: 'node_types_list',
    title: '节点类型清单',
    description:
      '列出客户端全部节点类型。默认只返回 type/name/description 摘要（响应小、速度快）；需要输入输出定义时传 detail=true，或传 type 查询单个节点的完整定义。开始流程（workflowStart）由系统自动创建，不要手动添加。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '按节点名称/类型过滤' },
        type: { type: 'string', description: '只看某个节点类型，并返回完整输入输出定义' },
        detail: { type: 'boolean', default: false, description: '是否返回全部节点的输入输出定义' },
        limit: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
      },
    },
    annotations: { readOnlyHint: true },
    handler: async ({ keyword = '', type = '', detail = false, limit = 200 }) =>
      callRenderer({ op: 'node.typesList', keyword, type, detail, limit }),
  });
};
