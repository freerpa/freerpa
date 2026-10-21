/**
 * @file: MCP 资源与提示词
 *  - 资源（resources）：把客户端只读快照以 URI 形式暴露给外部程序，避免大模型先调用工具再拼上下文
 *  - 提示词（prompts）：内置可复用的工作流构建指引，外部客户端可直接选用
 */
import { app } from 'electron';
import { getWorkflows, getWorkflow } from '../data/workflows/index.js';
import { getBrowsers } from '../data/browsers/index.js';
import { getModels } from '../data/models/index.js';
import { getElementSets } from '../data/elementSets/index.js';
import { mcpSettings, toolCount } from './registry.js';
import { getAllBrowserStatus } from '../browser/manager.js';
import { listRuns } from './runs.js';

const json = (uri, data) => ({
  contents: [
    {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(data, null, 2),
    },
  ],
});

const RESOURCES = [
  {
    uri: 'freerpa://system',
    name: '系统信息',
    description: '版本、平台、MCP 状态与运行概览',
    mimeType: 'application/json',
  },
  {
    uri: 'freerpa://workflows',
    name: '工作流列表',
    description: '当前全部工作流（不含回收站）',
    mimeType: 'application/json',
  },
  {
    uri: 'freerpa://browsers',
    name: '浏览器环境',
    description: '浏览器环境配置与运行状态',
    mimeType: 'application/json',
  },
  { uri: 'freerpa://data-models', name: '数据模型', description: '数据模型定义列表', mimeType: 'application/json' },
  { uri: 'freerpa://element-sets', name: '元素集', description: '元素集列表', mimeType: 'application/json' },
];

export const listResources = () => [...RESOURCES];

export const readResource = async (uri) => {
  const raw = String(uri || '');

  if (raw === 'freerpa://system') {
    return json(raw, {
      app: 'FreeRPA',
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      mcp: { ...mcpSettings(), tools: toolCount() },
      runs: listRuns({ limit: 10 }),
      browsers: getAllBrowserStatus(),
    });
  }

  if (raw === 'freerpa://workflows') return json(raw, await getWorkflows({ page: 1, pageSize: 200 }));
  if (raw === 'freerpa://browsers') {
    return json(raw, {
      environments: await getBrowsers({ page: 1, pageSize: 200 }),
      running: getAllBrowserStatus(),
    });
  }
  if (raw === 'freerpa://data-models') return json(raw, await getModels({ page: 1, pageSize: 200 }));
  if (raw === 'freerpa://element-sets') return json(raw, await getElementSets({ page: 1, pageSize: 200 }));

  // 动态资源：单个工作流 freerpa://workflow/<id>
  const match = raw.match(/^freerpa:\/\/workflow\/(.+)$/);
  if (match) {
    const workflow = await getWorkflow(decodeURIComponent(match[1]));
    if (!workflow) throw new Error(`工作流不存在：${match[1]}`);
    return json(raw, workflow);
  }

  throw new Error(`未知资源：${uri}`);
};

export const listPrompts = () => [
  {
    name: 'build_workflow',
    title: '构建 RPA 工作流',
    description: '引导模型按节点类型清单与图结构规范构建/修改工作流',
    arguments: [
      { name: 'goal', description: '要实现的业务流程（自然语言）', required: true },
      { name: 'workflowId', description: '要修改的已有工作流 id（留空表示新建）', required: false },
    ],
  },
  {
    name: 'operate_browser',
    title: '操作浏览器环境',
    description: '引导模型打开浏览器环境、连接 wsEndpoint 并执行页面自动化',
    arguments: [
      { name: 'envId', description: '浏览器环境 id（留空表示先创建）', required: false },
      { name: 'url', description: '要访问的网址', required: false },
    ],
  },
];

export const getPrompt = (name, args = {}) => {
  if (name === 'build_workflow') {
    const target = args.workflowId ? `已有工作流（id: ${args.workflowId}）` : '一个新建工作流';
    return {
      description: '构建 RPA 工作流',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `请使用 FreeRPA MCP 工具为${target}实现以下业务目标：${args.goal || '（未提供）'}`,
              '',
              '建议步骤：',
              '1. 调用 node_types_list 获取节点类型。默认返回摘要；先按 keyword 搜索，确需输入输出定义时再传 type 或 detail=true（全量详情体积很大）。',
              '2. 若修改已有工作流，先 workflow_get_graph 取出完整图，再在其基础上增量修改。',
              '3. 节点级编辑用 agent_tool_call（addNode/connect/updateNode/deleteNode/deleteEdge）。创建多个节点时务必使用 calls 批量提交，一次请求完成整条链路，避免逐节点多轮调用；工作流开始节点（workflowStart）由系统自动创建，不要手动添加。',
              '4. 参数引用格式为 {{节点名称.输出名称}}，只能整体引用输出；需要字段级加工时先加【提取数据】或【数据处理】节点。',
              '5. 完成后用 workflow_run 执行，再用 workflow_run_wait 等待结果（按预期时长设置 timeoutSec，不要一律用默认值）；失败时读取 error 并用 workflow_get_graph 定位修复。',
            ].join('\n'),
          },
        },
      ],
    };
  }

  if (name === 'operate_browser') {
    return {
      description: '操作浏览器环境',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              '请使用 FreeRPA MCP 工具完成浏览器自动化：',
              args.envId
                ? `1. 调用 browser_open 打开环境 ${args.envId}，拿到 wsEndpoint。`
                : '1. 若没有现成环境，先 browser_list 查找；仍没有则 browser_create 创建，再 browser_open。',
              `2. 访问 ${args.url || '目标网址'}，按业务目标操作页面。`,
              '3. 完成后调用 browser_close 释放实例；不要在未关闭的情况下遗留实例。',
            ].join('\n'),
          },
        },
      ],
    };
  }

  throw new Error(`未知提示词：${name}`);
};
