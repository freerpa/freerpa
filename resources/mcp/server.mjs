#!/usr/bin/env node
/**
 * FreeRPA MCP stdio 服务（无第三方依赖）
 *
 * 职责：把 MCP 客户端（Claude Desktop / Cursor / 自研程序）的 JSON-RPC over stdio
 * 转发到正在运行的 FreeRPA 客户端主进程内的本地桥接（HTTP 127.0.0.1 + Bearer Token）。
 *
 * 为什么需要这一层：
 *  - MCP 标准传输是「客户端拉起子进程 + stdio」，客户端无法接管已运行 Electron 主进程的 stdio；
 *  - 本文件由客户端以 `ELECTRON_RUN_AS_NODE=1` 方式启动，用户无需安装 Node。
 *
 * 连接信息：$FREERPA_MCP_BRIDGE_FILE（默认按平台用户数据目录推导）指向 bridge.json。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

const SERVER_NAME = 'freerpa';
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';
/** 工具调用可能包含 workflow_run_wait（最长 600s），这里留出缓冲 */
const RPC_TIMEOUT_MS = 660000;
const BRIDGE_WAIT_MS = 30000;

const log = (...args) => process.stderr.write(`[freerpa-mcp] ${args.join(' ')}\n`);

/** 各平台默认 bridge.json 路径（与 Electron app.getPath('userData') 默认值一致） */
const defaultBridgeFile = () => {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'FreeRPA', 'mcp', 'bridge.json');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'FreeRPA',
      'mcp',
      'bridge.json'
    );
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'FreeRPA', 'mcp', 'bridge.json');
};

const bridgeFile = () => process.env.FREERPA_MCP_BRIDGE_FILE || defaultBridgeFile();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readBridge = () => {
  try {
    const raw = fs.readFileSync(bridgeFile(), 'utf-8');
    const info = JSON.parse(raw);
    if (!info?.host || !info?.port || !info?.token) return null;
    return info;
  } catch {
    return null;
  }
};

let appLaunching = false;
/** 自动拉起客户端（打包环境下由配置注入 FREERPA_APP_PATH） */
const launchApp = () => {
  if (appLaunching) return;
  const appPath = process.env.FREERPA_APP_PATH;
  if (!appPath || !fs.existsSync(appPath)) return;
  appLaunching = true;
  try {
    // 必须移除 ELECTRON_RUN_AS_NODE：否则会把客户端当成 Node 进程执行（不创建窗口/不启动桥接）
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(appPath, [], { detached: true, stdio: 'ignore', env });
    child.unref();
    log('已尝试启动 FreeRPA 客户端');
  } catch (e) {
    log(`启动客户端失败: ${e?.message || e}`);
  }
};

/** 等待 bridge.json 出现且桥接健康（客户端可能正在启动） */
const waitBridge = async () => {
  const deadline = Date.now() + BRIDGE_WAIT_MS;
  launchApp();
  while (Date.now() < deadline) {
    await sleep(500);
    const info = readBridge();
    if (info && (await health(info))) return info;
  }
  return null;
};

/** 健康检查：确认 bridge.json 对应的进程仍存活（避免使用上次异常退出的陈旧端口） */
const health = (info) =>
  new Promise((resolve) => {
    const req = http.request(
      { host: info.host, port: info.port, path: '/health', method: 'GET', timeout: 2000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });

/** 确保拿到一个可用桥接（必要时拉起客户端并等待） */
const resolveBridge = async () => {
  const info = readBridge();
  if (info && (await health(info))) return info;
  // 文件缺失或客户端已退出：尝试拉起客户端并轮询可用性
  const fresh = await waitBridge();
  if (!fresh) {
    throw new Error(
      info
        ? `FreeRPA 客户端桥接不可用（${info.host}:${info.port}）。请确认客户端正在运行且「设置 → MCP 服务」已启用。`
        : `无法连接 FreeRPA 客户端：未找到 ${bridgeFile()}。请先启动 FreeRPA 客户端，并在「设置 → MCP 服务」中确认已启用。`
    );
  }
  return fresh;
};

/** POST 到桥接 /rpc */
const postRpc = (info, method, params) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify({ method, params });
    const req = http.request(
      {
        host: info.host,
        port: info.port,
        path: '/rpc',
        method: 'POST',
        timeout: RPC_TIMEOUT_MS,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-length': Buffer.byteLength(body),
          authorization: `Bearer ${info.token}`,
          'user-agent': 'freerpa-mcp-stdio/1.0',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let payload;
          try {
            payload = raw ? JSON.parse(raw) : {};
          } catch {
            reject(Object.assign(new Error(`桥接返回非 JSON（HTTP ${res.statusCode}）`), { code: -32700 }));
            return;
          }
          if (res.statusCode === 401) {
            reject(Object.assign(new Error('桥接鉴权失败（Token 已失效）'), { code: -32001, retryAuth: true }));
            return;
          }
          if (!payload?.ok) {
            const error = payload?.error || {};
            reject(
              Object.assign(new Error(error.message || `桥接调用失败（HTTP ${res.statusCode}）`), {
                code: error.code,
                data: error.data,
              })
            );
            return;
          }
          resolve(payload.data);
        });
      }
    );
    req.on('error', (e) => reject(Object.assign(new Error(`连接 FreeRPA 桥接失败: ${e.message}`), { code: -32000 })));
    req.on('timeout', () => {
      req.destroy();
      reject(Object.assign(new Error('FreeRPA 桥接响应超时'), { code: -32000 }));
    });
    req.end(body);
  });

/** 调用桥接（Token 失效时重新读取 bridge.json 重试一次） */
const callBridge = async (method, params) => {
  let info;
  try {
    info = await resolveBridge();
  } catch (e) {
    throw Object.assign(e, { code: e.code || -32000 });
  }
  try {
    return await postRpc(info, method, params);
  } catch (e) {
    if (!e.retryAuth) throw e;
    const fresh = readBridge();
    if (!fresh || fresh.token === info.token) throw e;
    return postRpc(fresh, method, params);
  }
};

// ─── JSON-RPC over stdio ────────────────────────────────────────

const write = (message) => {
  process.stdout.write(`${JSON.stringify(message)}\n`);
};

const reply = (id, result) => write({ jsonrpc: '2.0', id, result });

const replyError = (id, code, message, data) =>
  write({
    jsonrpc: '2.0',
    id,
    error: { code: code ?? -32000, message: message || '未知错误', ...(data ? { data } : {}) },
  });

const okResult = (id, result) => reply(id, result);
const failResult = (id, error) => replyError(id, error?.code, error?.message, error?.data);

/** tools/call 失败按 MCP 约定以 isError 内容返回（便于模型自纠，而非中断会话） */
const toolErrorResult = (id, error) =>
  reply(id, {
    content: [{ type: 'text', text: `执行失败：${error?.message || String(error)}` }],
    structuredContent: { ok: false, code: error?.code ?? -32000, message: error?.message || String(error) },
    isError: true,
  });

const handleInitialize = (id, params = {}) => {
  const requested = params?.protocolVersion;
  const version = readBridge()?.appVersion || process.env.FREERPA_MCP_VERSION || '1.0.0';
  reply(id, {
    protocolVersion: requested || DEFAULT_PROTOCOL_VERSION,
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
      logging: {},
    },
    serverInfo: { name: SERVER_NAME, version },
    instructions:
      'FreeRPA 是本地 RPA 客户端。可用工具管理/执行工作流、浏览器环境、数据模型、元素集与节点级编辑。' +
      '执行工作流先用 workflow_get_graph 或 node_types_list 了解结构；参数引用格式为 {{节点名称.输出名称}}。',
  });
};

const dispatch = async (message) => {
  const { id, method, params } = message || {};
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case 'initialize':
        return handleInitialize(id, params);

      case 'ping':
        return okResult(id, {});

      // 客户端通知：无需响应
      case 'notifications/initialized':
      case 'notifications/cancelled':
      case 'notifications/roots/list_changed':
        return undefined;

      case 'tools/list':
        return okResult(id, await callBridge('tools/list', params || {}));

      case 'tools/call':
        try {
          return okResult(id, await callBridge('tools/call', params || {}));
        } catch (e) {
          return toolErrorResult(id, e);
        }

      case 'resources/list':
        return okResult(id, await callBridge('resources/list', params || {}));

      case 'resources/read':
        return okResult(id, await callBridge('resources/read', params || {}));

      case 'prompts/list':
        return okResult(id, await callBridge('prompts/list', params || {}));

      case 'prompts/get':
        return okResult(id, await callBridge('prompts/get', params || {}));

      case 'roots/list':
        return okResult(id, { roots: [] });

      case 'logging/setLevel':
        return okResult(id, {});

      default:
        if (isNotification) return undefined;
        return replyError(id, -32601, `未实现的方法：${method}`);
    }
  } catch (error) {
    if (isNotification) {
      log(`通知处理失败 ${method}: ${error?.message || error}`);
      return undefined;
    }
    if (method === 'tools/call') return toolErrorResult(id, error);
    return failResult(id, error);
  }
};

const handleLine = async (line) => {
  const text = line.trim();
  if (!text) return;
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    replyError(null, -32700, '无法解析 JSON');
    return;
  }
  // JSON-RPC 批量（部分老客户端仍会发送）
  if (Array.isArray(payload)) {
    for (const item of payload) await dispatch(item);
    return;
  }
  await dispatch(payload);
};

const main = () => {
  // 读循环：允许并发处理（例如客户端同时发起多个工具调用）
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    handleLine(line).catch((e) => log(`处理失败: ${e?.message || e}`));
  });
  rl.on('close', () => {
    process.exit(0);
  });

  process.on('uncaughtException', (e) => {
    log(`未捕获异常: ${e?.stack || e}`);
    process.exit(1);
  });
  process.on('unhandledRejection', (e) => {
    log(`未处理的 Promise 拒绝: ${e?.stack || e}`);
  });
};

main();
