/**
 * @file: MCP 工具注册表与统一执行入口（主进程）
 *
 * 设计要点（对齐现有 Agent 工具思路）：
 *  - 工具是「意图级」而非 IPC 裸映射：名称/描述/JSON Schema 面向大模型，handler 在内部组合同步与异步能力
 *  - 注解（readOnlyHint / destructiveHint）驱动权限门禁：只读模式、危险操作二次确认
 *  - 结果统一为 MCP 形态：content(text) + structuredContent，错误抛 McpError 由桥接层转 JSON-RPC 错误
 *  - 所有调用写入 NDJSON 审计日志（userData/mcp/audit-<date>.ndjson），便于追溯外部程序做了什么
 */
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { get as storeGet } from '../store/index.js';

const registry = new Map();

/** MCP 错误：code 为 JSON-RPC 错误码，供协议层直接透传 */
export class McpError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.data = data;
  }
}

/** 注册一个工具（重复注册覆盖，便于按模块聚合） */
export const defineTool = (def) => {
  if (!def?.name || typeof def.handler !== 'function') {
    throw new Error('MCP 工具定义不合法：缺少 name 或 handler');
  }
  registry.set(def.name, def);
};

/** 工具清单（剥离 handler，返回可序列化的 MCP Tool 定义） */
export const listTools = () =>
  [...registry.values()].map((tool) => {
    const def = { ...tool };
    delete def.handler;
    // 破坏性工具自动补全 confirm 参数，让客户端在 schema 阶段就知道需要显式确认
    if (def.annotations?.destructiveHint) {
      const schema = def.inputSchema || { type: 'object', properties: {} };
      def.inputSchema = {
        ...schema,
        properties: {
          ...(schema.properties || {}),
          confirm: { type: 'boolean', description: '必须传 true 才会执行（不可撤销操作）' },
        },
      };
    }
    return def;
  });

export const toolCount = () => registry.size;

/** MCP 运行配置（设置中心可改）：默认启用；readOnly 打开后所有写操作被拒绝；port=0 表示自动分配 */
export const mcpSettings = () => {
  const raw = storeGet('mcp') || {};
  const port = Number(raw.port);
  return {
    enabled: raw.enabled !== false,
    readOnly: !!raw.readOnly,
    port: Number.isInteger(port) && port >= 0 && port <= 65535 ? port : 0,
  };
};

const auditPath = () =>
  path.join(app.getPath('userData'), 'mcp', `audit-${new Date().toISOString().slice(0, 10)}.ndjson`);

/** 审计参数摘要：截断超长内容（如整份工作流 graph / 批量数据），避免审计文件无限膨胀 */
const auditArgs = (args) => {
  try {
    const text = JSON.stringify(args ?? {});
    return text.length > 4096 ? { _truncated: true, length: text.length, preview: `${text.slice(0, 4096)}…` } : args;
  } catch {
    return { _error: '参数无法序列化' };
  }
};

/** 审计日志：异步追加，失败静默（绝不因审计影响工具执行） */
const audit = (entry) => {
  try {
    const file = auditPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFile(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', () => {});
  } catch {
    /* ignore */
  }
};

/** 读取审计日志尾部（设置中心展示最近调用） */
export const readAuditTail = (limit = 50) => {
  try {
    const file = auditPath();
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const toText = (value) => {
  if (typeof value === 'string') return value;
  try {
    const compact = JSON.stringify(value);
    // 小结果保留缩进便于阅读；大结果用紧凑 JSON，避免把大量空白也塞进模型上下文
    return compact.length > 4096 ? compact : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

/** 统一包装工具结果为 MCP CallToolResult */
export const toToolResult = (data) => {
  const structured = data && typeof data === 'object' && !Array.isArray(data) ? data : { value: data ?? null };
  return {
    content: [{ type: 'text', text: toText(data) }],
    structuredContent: structured,
  };
};

/**
 * 执行工具（含权限门禁、必填校验、危险操作确认、审计）
 * @param {string} name 工具名
 * @param {object} args 参数
 * @param {object} meta { client, transport }
 */
export const executeTool = async (name, args = {}, meta = {}) => {
  const tool = registry.get(name);
  if (!tool) throw new McpError(-32601, `未知工具：${name}`);

  const settings = mcpSettings();
  if (!settings.enabled) {
    throw new McpError(-32000, 'MCP 服务未启用：请在 FreeRPA 设置中心 → MCP 服务中开启');
  }
  if (settings.readOnly && !tool.annotations?.readOnlyHint) {
    throw new McpError(-32003, `当前为只读模式，禁止执行写操作：${name}`);
  }

  const required = tool.inputSchema?.required || [];
  const missing = required.filter((key) => args[key] === undefined || args[key] === null);
  if (missing.length) {
    throw new McpError(-32602, `缺少必填参数：${missing.join(', ')}`);
  }

  // 破坏性操作必须显式 confirm: true（防止模型误删；也让审计日志可区分人工确认）
  if (tool.annotations?.destructiveHint && args.confirm !== true) {
    throw new McpError(
      -32004,
      `该操作不可撤销或影响正在运行的任务，需在参数中显式传入 "confirm": true 以确认执行（${name}）`
    );
  }

  const started = Date.now();
  try {
    const data = await tool.handler(args, meta);
    audit({ tool: name, ok: true, ms: Date.now() - started, args: auditArgs(args), client: meta.client });
    return toToolResult(data);
  } catch (e) {
    const err = e instanceof McpError ? e : new McpError(-32000, e?.message || String(e));
    audit({
      tool: name,
      ok: false,
      ms: Date.now() - started,
      args: auditArgs(args),
      error: err.message,
      client: meta.client,
    });
    throw err;
  }
};
