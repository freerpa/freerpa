/**
 * @file: MCP 本地桥接服务（主进程，HTTP + Bearer Token）
 *
 * 为什么需要桥接而不是把 MCP 直接跑在主进程：
 *   MCP 的标准传输 stdio 由「MCP 客户端」拉起子进程，而客户端无法直接接管已在运行的 Electron 主进程 stdio。
 *   因此采用业界通行的两层结构：
 *     MCP 客户端 ──stdio──> resources/mcp/server.mjs（独立 shim，打包时由 esbuild 生成）
 *     shim ──HTTP(127.0.0.1 + Token)──> 本文件（运行在 FreeRPA 主进程，直接访问数据库/浏览器/执行引擎）
 * 安全约束：
 *   - 仅绑定 127.0.0.1（不监听外网）
 *   - 每次启动生成随机 Token，写入 userData/mcp/bridge.json（权限 0600），并随桥接关闭删除
 *   - 审计日志记录每次工具调用（registry.js），设置中心可查看最近调用
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { McpError, executeTool, listTools, mcpSettings, toolCount } from './registry.js';
import { listResources, readResource, listPrompts, getPrompt } from './resources.js';
import { registerAllTools } from './tools/index.js';
import { registerRunEvents } from './runs.js';

const MAX_BODY = 8 * 1024 * 1024; // 8MB（工作流 graph 可能较大）
const LOOPBACK = '127.0.0.1';

let server = null;
let bridgeInfo = null;
let runEventsRegistered = false;

const stateDir = () => path.join(app.getPath('userData'), 'mcp');
const bridgeFile = () => path.join(stateDir(), 'bridge.json');

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new McpError(-32600, `请求体超过上限（${MAX_BODY} 字节）`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new McpError(-32700, '请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });

/** 常量时间比较，避免 Token 时序侧信道 */
const tokenEquals = (a, b) => {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
};

const authorized = (req) => {
  if (!bridgeInfo?.token) return false;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return tokenEquals(token, bridgeInfo.token);
};

/** 内部 RPC 分发（方法名与 MCP 语义对齐，便于 shim 透传） */
const dispatch = async (method, params = {}, meta = {}) => {
  switch (method) {
    case 'ping':
      return { pong: true, ts: Date.now() };
    case 'tools/list':
      return { tools: listTools() };
    case 'tools/call': {
      const name = params?.name;
      if (!name) throw new McpError(-32602, 'tools/call 缺少 name');
      return executeTool(name, params?.arguments || {}, meta);
    }
    case 'resources/list':
      return { resources: listResources() };
    case 'resources/read': {
      if (!params?.uri) throw new McpError(-32602, 'resources/read 缺少 uri');
      return readResource(params.uri);
    }
    case 'prompts/list':
      return { prompts: listPrompts() };
    case 'prompts/get': {
      if (!params?.name) throw new McpError(-32602, 'prompts/get 缺少 name');
      return getPrompt(params.name, params?.arguments || {});
    }
    case 'status':
      return {
        ok: true,
        app: 'FreeRPA',
        version: app.getVersion(),
        tools: toolCount(),
        settings: mcpSettings(),
      };
    default:
      throw new McpError(-32601, `未知方法：${method}`);
  }
};

const onRequest = async (req, res) => {
  // 健康检查（无需鉴权，仅暴露最小信息，供 shim 判断服务是否就绪）
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, {
      ok: true,
      app: 'FreeRPA',
      version: app.getVersion(),
      tools: toolCount(),
    });
  }

  if (req.method === 'POST' && req.url === '/rpc') {
    if (!authorized(req))
      return sendJson(res, 401, { ok: false, error: { code: -32001, message: '未授权：Token 无效' } });
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: { code: e.code || -32700, message: e.message } });
    }
    try {
      const data = await dispatch(body.method, body.params, {
        client: req.headers['user-agent'] || 'unknown',
        transport: 'http-bridge',
      });
      return sendJson(res, 200, { ok: true, data });
    } catch (e) {
      const code = e instanceof McpError ? e.code : -32000;
      return sendJson(res, 200, { ok: false, error: { code, message: e?.message || String(e), data: e?.data } });
    }
  }

  return sendJson(res, 404, { ok: false, error: { code: -32601, message: 'Not Found' } });
};

/** 监听指定端口（0 = 由系统分配空闲端口），失败时 reject 原始错误（如 EADDRINUSE） */
const listenOn = (srv, port) =>
  new Promise((resolve, reject) => {
    const onError = (e) => {
      srv.off('listening', onListening);
      reject(e);
    };
    const onListening = () => {
      srv.off('error', onError);
      resolve();
    };
    srv.once('error', onError);
    srv.once('listening', onListening);
    srv.listen(port, LOOPBACK);
  });

/** 启动桥接（幂等）。返回对外的连接信息（含 token，仅主进程内部使用） */
export const startMcpBridge = async () => {
  registerAllTools();
  if (!runEventsRegistered) {
    registerRunEvents();
    runEventsRegistered = true;
  }
  if (!mcpSettings().enabled) return null;
  if (server) return bridgeInfo;

  const token = crypto.randomBytes(32).toString('hex');
  server = http.createServer((req, res) => {
    onRequest(req, res).catch((e) => {
      try {
        sendJson(res, 500, { ok: false, error: { code: -32000, message: e?.message || String(e) } });
      } catch {
        /* 响应已结束 */
      }
    });
  });
  // 工具调用可能长时间等待（workflow_run_wait 最长 10 分钟），关闭请求超时
  server.requestTimeout = 0;
  server.timeout = 0;

  // 优先使用用户配置的端口；被占用时自动回退到系统分配的随机端口（记录原因供设置页展示）
  const requestedPort = mcpSettings().port;
  let portFallback = null;
  try {
    try {
      await listenOn(server, requestedPort);
    } catch (e) {
      if (requestedPort === 0) throw e;
      portFallback = { requested: requestedPort, reason: e?.code || e?.message || 'listen failed' };
      await listenOn(server, 0);
      console.warn(`[MCP] 端口 ${requestedPort} 不可用（${portFallback.reason}），已改用随机端口`);
    }
  } catch (e) {
    server = null;
    throw e;
  }

  const { port } = server.address();
  bridgeInfo = {
    version: 1,
    app: 'FreeRPA',
    appVersion: app.getVersion(),
    host: LOOPBACK,
    port,
    requestedPort,
    portFallback,
    token,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };

  // 写入连接信息（0600）：shim 与外部程序据此连接
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    fs.writeFileSync(bridgeFile(), JSON.stringify(bridgeInfo, null, 2), { mode: 0o600 });
    fs.chmodSync(bridgeFile(), 0o600);
  } catch (e) {
    console.error('[MCP] 写入 bridge.json 失败:', e?.message || e);
  }

  global.__freerpaMcpBridgeInfo = { host: bridgeInfo.host, port: bridgeInfo.port, pid: bridgeInfo.pid };
  console.log(`[MCP] 桥接已启动: http://${LOOPBACK}:${port}（工具 ${toolCount()} 个）`);
  return bridgeInfo;
};

/** 关闭桥接并清理连接信息（MCP 关闭/应用退出时调用） */
export const stopMcpBridge = async () => {
  if (server) {
    const current = server;
    server = null;
    await new Promise((resolve) => {
      // 长请求（workflow_run_wait）可能占用连接，最多等待 1 秒后强制结束，避免退出卡死
      const timer = setTimeout(resolve, 1000);
      current.close(() => {
        clearTimeout(timer);
        resolve();
      });
      current.closeAllConnections?.();
    });
  }
  bridgeInfo = null;
  global.__freerpaMcpBridgeInfo = null;
  try {
    fs.rmSync(bridgeFile(), { force: true });
  } catch {
    /* ignore */
  }
};

export const getBridgeInfo = () => bridgeInfo;

export const isBridgeRunning = () => !!server;

/**
 * 生成外部 MCP 客户端配置（Claude Desktop / Cursor 等通用 stdio 配置）
 * 命令使用 Electron 自身的 Node 模式执行已打包的 shim，用户无需安装 Node。
 */
export const buildClientConfig = () => {
  const isPackaged = app.isPackaged;
  const shimPath = isPackaged
    ? path.join(process.resourcesPath, 'mcp', 'server.mjs')
    : path.join(app.getAppPath(), 'resources', 'mcp', 'server.mjs');

  const env = {
    ELECTRON_RUN_AS_NODE: '1',
    FREERPA_MCP_BRIDGE_FILE: bridgeFile(),
  };
  if (isPackaged) env.FREERPA_APP_PATH = process.execPath;

  return {
    bridgeFile: bridgeFile(),
    shimPath,
    command: process.execPath,
    args: [shimPath],
    env,
    config: {
      mcpServers: {
        freerpa: {
          command: process.execPath,
          args: [shimPath],
          env,
        },
      },
    },
  };
};
