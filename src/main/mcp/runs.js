/**
 * @file: MCP 运行实例管理（主进程）
 *
 * 工作流执行必须复用渲染进程的工作流引擎（节点定义、参数引用解析、IO 重建都在渲染端），
 * 因此这里只做「运行台账」：发起执行、订阅渲染端回报的状态、提供查询/等待/停止。
 *  - 状态：starting → running → completed | stopped | error
 *  - 台账常驻内存（最近 MAX_RUNS 条），进程退出即清空；外部程序通过 runId 轮询
 */
import { randomBytes } from 'crypto';
import { ipcMain } from 'electron';
import { sendToRendererAsync } from '../workflow/host/rendererUtils.js';

const runs = new Map();
const MAX_RUNS = 200;
const TERMINAL = new Set(['completed', 'stopped', 'error']);

const newRunId = () => `mcp-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

const trim = () => {
  if (runs.size <= MAX_RUNS) return;
  // Map 保持插入顺序：从最早的终态实例开始淘汰
  for (const [id, run] of runs) {
    if (runs.size <= MAX_RUNS) break;
    if (TERMINAL.has(run.status)) runs.delete(id);
  }
};

const publicRun = (run) => ({
  runId: run.runId,
  workflowId: run.workflowId,
  status: run.status,
  error: run.error,
  startedAt: run.startedAt,
  endedAt: run.endedAt,
  durationMs: (run.endedAt || Date.now()) - run.startedAt,
});

/** 发起执行（异步，立即返回 runId；执行进度通过状态查询获取） */
export const createRun = async ({ workflowId, debug = false }) => {
  const run = {
    runId: newRunId(),
    workflowId,
    status: 'starting',
    error: '',
    debug: !!debug,
    startedAt: Date.now(),
    endedAt: null,
  };
  runs.set(run.runId, run);
  trim();
  try {
    const response = await sendToRendererAsync('mcp:exec', {
      op: 'workflow.run',
      workflowId,
      runId: run.runId,
      debug: run.debug,
    });
    if (response?.ok === false) throw new Error(response.error || '渲染端执行失败');
  } catch (e) {
    run.status = 'error';
    run.error = e?.message || String(e);
    run.endedAt = Date.now();
  }
  return publicRun(run);
};

export const getRun = (runId) => {
  const run = runs.get(runId);
  return run ? publicRun(run) : null;
};

export const listRuns = ({ status, limit = 20 } = {}) => {
  const all = [...runs.values()].reverse();
  const filtered = status ? all.filter((r) => r.status === status) : all;
  return filtered.slice(0, Math.max(1, Math.min(100, limit))).map(publicRun);
};

/** 等待实例到达终态（轮询台账；超时返回最后一次快照） */
export const waitRun = async (runId, timeoutMs = 60000) => {
  const run = runs.get(runId);
  if (!run) return null;
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    if (TERMINAL.has(run.status)) return publicRun(run);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return publicRun(run);
};

/** 停止实例：渲染端执行 stopFlow（节点销毁钩子会释放浏览器），并兜底强销毁 */
export const stopRun = async (runId) => {
  const run = runs.get(runId);
  if (!run) return null;
  if (TERMINAL.has(run.status)) return publicRun(run);
  try {
    const response = await sendToRendererAsync('mcp:exec', { op: 'workflow.stop', runId });
    if (response?.ok === false) throw new Error(response.error || '渲染端停止失败');
  } catch (e) {
    run.error = run.error || e?.message || String(e);
  }
  if (!TERMINAL.has(run.status)) {
    run.status = 'stopped';
    run.endedAt = Date.now();
  }
  return publicRun(run);
};

/** 运行状态回报（渲染端 → 主进程）：mcp:runEvent */
export const registerRunEvents = () => {
  ipcMain.on('mcp:runEvent', (_event, payload = {}) => {
    const run = runs.get(payload.runId);
    if (!run) return;
    if (payload.status) run.status = payload.status;
    if (payload.error !== undefined) run.error = payload.error || '';
    if (payload.workflowId) run.workflowId = payload.workflowId;
    if (TERMINAL.has(run.status)) run.endedAt = run.endedAt || Date.now();
    else run.endedAt = null;
  });
};
