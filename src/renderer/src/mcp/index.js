/**
 * @file: MCP 渲染进程执行器
 *
 * 为什么执行必须放渲染进程：
 *  - 工作流节点的输入/输出定义来自 `@nodes-path`（Vue 组件 + 图标），只有渲染端能加载；
 *  - 参数引用（{{节点.输出}}）解析依赖节点定义与动态 IO，同样只在渲染端可用；
 *  - 内置 Agent 工具（节点增删改连）直接操作 vueFlowRef 画布实例。
 *
 * 主进程通过 preload 的 `mcp:exec` 通道委托到这里（见 src/preload/index.js），
 * 执行结果由 preload 回传 `mcp:exec:response:<id>`；运行状态通过 `mcp:runEvent` 回报台账。
 */
import nodes, { loadPluginNodes } from '@nodes-path';
import { storeToRefs } from 'pinia';
import { useStore } from '@/store';
import { useFlowStore } from '@/workflow/store';
import { getNodeInputs, getNodeOutputs } from '@/workflow/resolve-io';
import { getFlowData, resolveParamRefs } from '@/workflow/engine/validate';
import { buildTools, buildExecutors } from '@/ai/tools';

const { mcp: mcpAPI, workflow: workflowAPI } = window.electronAPI;

/** startFlow 后迟迟收不到 running 事件即判启动失败（与批量执行一致，避免实例永远停在 starting） */
const START_TIMEOUT = 15000;
/** 打开画布并等待节点初始化完成的上限（含工作流图加载与节点渲染） */
const CANVAS_READY_TIMEOUT = 20000;

/** 运行中的实例：runId → { unsub, watchdog } */
const activeRuns = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseGraph = (graph) => {
  if (!graph) return { nodes: [], edges: [] };
  if (typeof graph === 'string') {
    try {
      return JSON.parse(graph);
    } catch {
      throw new Error('工作流图数据损坏（graph 不是合法 JSON）');
    }
  }
  return graph;
};

let pluginLoaded = false;
/** 插件节点按需加载（应用启动时已异步加载；外部调用可能早于其完成） */
const ensurePluginNodes = async () => {
  if (pluginLoaded) return;
  try {
    await loadPluginNodes();
    pluginLoaded = true;
  } catch {
    /* 插件 API 不可用时忽略，缺失节点会在校验时明确报错 */
  }
};

/**
 * 从数据库 graph 重建可执行的 flowData（无需画布）：
 * 补齐每个节点的 inputs/outputs（动态 IO 由 config 推导），再复用官方 getFlowData + resolveParamRefs。
 * @returns {Object} 纯对象 flowData（id 已替换为 runId）
 */
const buildFlowDataFromGraph = (graph, workflowId, runId, debug) => {
  const rawNodes = (graph.nodes || []).map((node) => ({
    id: node.id,
    type: node.type,
    parentNode: node.parentNode,
    data: {
      name: node.data?.name || node.id,
      type: node.data?.type || node.type,
      version: node.data?.version || 'V1',
      config: node.data?.config || {},
      deactivate: !!node.data?.deactivate,
      inputs: Array.isArray(node.data?.inputs) ? node.data.inputs : [],
      outputs: Array.isArray(node.data?.outputs) ? node.data.outputs : [],
    },
  }));

  // 缺少业务 type 或本地插件未安装：直接拒绝，避免 worker 执行到一半才失败
  const missing = rawNodes.filter((n) => !n.data.type || !nodes[n.data.type]);
  if (missing.length) {
    throw new Error(
      `工作流包含 ${missing.length} 个缺少本地插件的节点：${missing
        .map((n) => `【${n.data.name}】`)
        .join('、')}，请先安装对应插件`
    );
  }

  // 先补 inputs（子流程结束节点的输入可能被输出计算复用），再补 outputs
  rawNodes.forEach((node) => {
    if (!node.data.inputs.length) node.data.inputs = getNodeInputs(node, nodes);
  });
  rawNodes.forEach((node) => {
    if (!node.data.outputs.length) node.data.outputs = getNodeOutputs(node, rawNodes, nodes);
  });

  const rawEdges = (graph.edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: edge.data || {},
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }));

  // 复用 getFlowData：它按 Vue Flow 节点结构读取，这里提供同构的只读视图
  const pseudoStore = {
    $id: `flow_${workflowId}`,
    debug: !!debug,
    vueFlowRef: { getNodes: rawNodes, getEdges: rawEdges },
  };
  const flowData = getFlowData(pseudoStore, runId);
  const { flowData: resolved, errors } = resolveParamRefs(flowData, pseudoStore.vueFlowRef);
  if (errors.length) throw new Error(errors[0].error);

  // 与批量执行保持一致：实例级资源隔离（同环境共用内核、本地网络服务随机端口）
  resolved.isolated = true;
  resolved.sourceId = workflowId;
  return JSON.parse(JSON.stringify(resolved));
};

/** 释放实例台账（取消订阅 + 清除看门狗） */
const releaseRun = (runId) => {
  const entry = activeRuns.get(runId);
  if (!entry) return null;
  clearTimeout(entry.watchdog);
  entry.unsub?.();
  activeRuns.delete(runId);
  return entry;
};

/** 发起渲染端执行：先订阅状态，再 createEngine → startFlow（避免漏掉首个 running 事件） */
const runWorkflow = async ({ workflowId, runId, debug = false }) => {
  if (!workflowId) throw new Error('缺少 workflowId');
  if (!runId) throw new Error('缺少 runId');

  await ensurePluginNodes();
  const workflow = await workflowAPI.getWorkflow(workflowId);
  if (!workflow) throw new Error(`工作流不存在：${workflowId}`);
  const flowData = buildFlowDataFromGraph(parseGraph(workflow.graph), workflowId, runId, debug);

  // 同一 runId 重复执行：先回收旧订阅，避免状态回报重复
  releaseRun(runId);

  const entry = { unsub: null, watchdog: null };
  entry.unsub = window.electronAPI.onFlowEvent('stateChange', runId, null, (_event, data) => {
    const state = data?.state;
    if (!state) return;
    if (state === 'running') {
      clearTimeout(entry.watchdog);
      entry.watchdog = null;
    }
    mcpAPI.sendRunEvent({ runId, workflowId, status: state, error: data?.error || '' });
    if (state === 'completed' || state === 'stopped' || state === 'error') {
      if (activeRuns.get(runId) === entry) releaseRun(runId);
    }
  });
  activeRuns.set(runId, entry);

  entry.watchdog = setTimeout(() => {
    if (!activeRuns.has(runId)) return;
    mcpAPI.sendRunEvent({ runId, workflowId, status: 'error', error: '启动超时：未收到执行状态事件' });
    releaseRun(runId);
    window.electronAPI.emitFlowEvent('destroyEngine', null, null, runId).catch(() => {});
  }, START_TIMEOUT);

  try {
    const created = await window.electronAPI.emitFlowEvent('createEngine', null, null, flowData);
    if (!created?.success) throw new Error(created?.message || '创建执行实例失败');
    const started = await window.electronAPI.emitFlowEvent('startFlow', null, null, runId);
    // 主进程 startFlow 失败返回 { success:false }（不抛异常）
    if (started && started.success === false) throw new Error(started.message || '启动工作流失败');
  } catch (error) {
    releaseRun(runId);
    throw error;
  }

  return { runId, workflowId, status: 'starting' };
};

/** 停止执行实例：stopFlow（走节点销毁钩子）→ destroyEngine 兜底回收 */
const stopWorkflow = async ({ runId }) => {
  if (!runId) throw new Error('缺少 runId');
  clearTimeout(activeRuns.get(runId)?.watchdog);
  try {
    await window.electronAPI.emitFlowEvent('stopFlow', null, null, runId);
  } catch {
    /* 实例可能已结束/宿主不可用，下方兜底销毁 */
  }
  try {
    await window.electronAPI.emitFlowEvent('destroyEngine', null, null, runId);
  } catch {
    /* 已销毁 */
  }
  releaseRun(runId);
  mcpAPI.sendRunEvent({ runId, status: 'stopped' });
  return { runId, status: 'stopped' };
};

/** 确保工作流画布已打开且初始化完成（Agent 工具依赖 vueFlowRef） */
const ensureWorkflowCanvas = async (workflowId) => {
  const appStore = useStore();
  const flowStore = useFlowStore(workflowId);
  // 画布已初始化时直接复用，避免每次工具调用都切换用户当前标签页
  if (flowStore.initialized && flowStore.vueFlowRef) return flowStore;
  if (!appStore.openedTabs[workflowId]) {
    const workflow = await workflowAPI.getWorkflow(workflowId);
    if (!workflow) throw new Error(`工作流不存在：${workflowId}`);
    appStore.openedTabs[workflowId] = {
      id: workflowId,
      type: 'workflow',
      name: workflow.name,
      workflow,
      store: storeToRefs(useFlowStore(workflowId)),
    };
  }
  appStore.switchTab(workflowId);

  const deadline = Date.now() + CANVAS_READY_TIMEOUT;
  while (Date.now() < deadline) {
    if (flowStore.initialized && flowStore.vueFlowRef) return flowStore;
    await sleep(100);
  }
  throw new Error(
    `工作流画布加载超时（initialized=${!!flowStore.initialized}，vueFlowRef=${!!flowStore.vueFlowRef}），请稍后重试`
  );
};

/**
 * Agent 工具清单
 * 只暴露节点级编辑能力：浏览器/数据表/元素集/工作流查询在 MCP 侧已有原生工具，
 * 重复暴露会增大 agent_tools_list 体积并让模型在两套接口间摇摆。
 * finish 仅用于内置 AI 会话终止，同样不暴露。
 */
const AGENT_BRIDGE_TOOLS = ['getNodeConfig', 'addNode', 'connect', 'updateNode', 'deleteNode', 'deleteEdge'];

const listAgentTools = () =>
  buildTools({}).filter((tool) => tool?.function?.name && AGENT_BRIDGE_TOOLS.includes(tool.function.name));

/** 执行单个 Agent 工具 */
const runAgentTool = async (executors, tool, args = {}) => {
  if (!tool) throw new Error('缺少 tool');
  if (tool === 'finish') throw new Error('finish 仅用于内置 AI 会话，请直接调用目标工具');
  const handler = executors[tool];
  if (typeof handler !== 'function') throw new Error(`未知 Agent 工具：${tool}`);
  return handler(args || {});
};

/**
 * 调用 Agent 工具（支持单次或批量）
 * 批量模式只打开一次画布并顺序执行，避免外部程序逐节点调用产生大量往返；
 * 默认遇错即停：后续操作通常依赖前一步创建的节点，继续执行只会产生连锁错误。
 */
const callAgentTool = async ({ workflowId, tool, arguments: args = {}, calls, stopOnError = true }) => {
  if (!workflowId) throw new Error('缺少 workflowId');
  await ensureWorkflowCanvas(workflowId);
  const executors = buildExecutors({ workflowId });

  if (Array.isArray(calls)) {
    if (!calls.length) throw new Error('calls 不能为空');
    const results = [];
    let stopped = false;
    for (let i = 0; i < calls.length; i++) {
      const item = calls[i] || {};
      if (stopped) {
        results.push({ index: i, tool: item.tool, skipped: true });
        continue;
      }
      try {
        const result = await runAgentTool(executors, item.tool, item.arguments);
        results.push({ index: i, tool: item.tool, ...(result || {}) });
      } catch (e) {
        results.push({ index: i, tool: item.tool, ok: false, error: e?.message || String(e) });
        if (stopOnError) stopped = true;
      }
    }
    return { total: calls.length, executed: results.filter((r) => !r.skipped).length, stopped, results };
  }

  return runAgentTool(executors, tool, args);
};

const pickIO = (io) => ({
  id: io?.id,
  name: io?.name || io?.id,
  type: io?.type,
  description: io?.description || '',
  required: !!io?.required,
  ...(io?.type === 'dynamic' ? { dataPath: io?.dataPath } : {}),
});

const toTypeSummary = ([type, def]) => ({
  type,
  name: def?.name || type,
  description: def?.description || '',
  version: def?._version || 'V1',
  hasConfigForm: Array.isArray(def?.config) && def.config.length > 0,
  // 开始流程由系统自动创建，外部程序不应添加；子流程容器内部同理
  ...(type === 'workflowStart' ? { autoCreated: true, addable: false } : {}),
});

const toTypeDetail = ([type, def]) => ({
  ...toTypeSummary([type, def]),
  inputs: (def?.inputs || []).filter(Boolean).map(pickIO),
  outputs: (def?.outputs || []).filter(Boolean).map(pickIO),
});

/**
 * 节点类型清单
 * 默认只返回 type/name/description 摘要（体积小、响应快）；
 * detail=true 或指定 type 时才返回输入输出定义。
 */
const listNodeTypes = async ({ keyword = '', type = '', detail = false, limit = 200 } = {}) => {
  await ensurePluginNodes();
  const kw = String(keyword || '')
    .trim()
    .toLowerCase();
  const entries = Object.entries(nodes)
    .filter(([t, def]) => {
      if (type && t !== type) return false;
      if (!kw) return true;
      return (
        t.toLowerCase().includes(kw) ||
        String(def?.name || '')
          .toLowerCase()
          .includes(kw)
      );
    })
    .sort(([a], [b]) => a.localeCompare(b));
  const full = !!detail || !!type;
  const list = entries
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 200)))
    .map((entry) => (full ? toTypeDetail(entry) : toTypeSummary(entry)));
  return { total: entries.length, detail: full, nodes: list };
};

const ops = {
  'workflow.run': runWorkflow,
  'workflow.stop': stopWorkflow,
  'agent.toolsList': async () => listAgentTools(),
  'agent.toolCall': callAgentTool,
  'node.typesList': listNodeTypes,
};

/**
 * 注册 MCP 执行委托（应用启动时调用一次）。
 * 返回取消注册函数；preload 不可用（例如非 Electron 环境）时静默跳过。
 */
export const registerMcpExecutor = () => {
  if (!mcpAPI?.onExec) return () => {};
  // 开发期 HMR 可能重复执行注册：只保留一个监听，避免同一请求被执行两次
  if (window.__freerpaMcpExecutorRegistered) return () => {};
  window.__freerpaMcpExecutorRegistered = true;
  return mcpAPI.onExec(async (payload = {}) => {
    const handler = ops[payload?.op];
    if (!handler) throw new Error(`未知 MCP 执行操作：${payload?.op || '(空)'}`);
    return handler(payload);
  });
};
