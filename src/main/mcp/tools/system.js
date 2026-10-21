/**
 * @file: MCP 系统工具（应用信息 / 运行概览 / 插件 / 配置读取）
 */
import { app } from 'electron';
import { get as storeGet, set as storeSet, list as storeList, remove as storeRemove } from '../../store/index.js';
import { listPlugins, findPluginByIdentifier, findPlugin } from '../../plugin/manifest.js';
import { getAllBrowserStatus } from '../../browser/manager.js';
import { listRuns } from '../runs.js';
import { defineTool, mcpSettings, toolCount } from '../registry.js';

/** 禁止外部 MCP 写入的系统配置 key（权限、模型密钥、网络服务、数据库路径、MCP 自身配置） */
const PROTECTED_KEYS = new Set(['permissions', 'aiProviders', 'networkServer', 'allowedRoot', 'dbPath', 'mcp']);

export const registerSystemTools = () => {
  defineTool({
    name: 'system_info',
    title: '客户端信息',
    description:
      '返回 FreeRPA 版本、运行平台、Electron/Node/Chrome 版本、关键目录路径、MCP 服务状态与工具数量。适合程序启动时做能力探测。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => {
      const settings = mcpSettings();
      return {
        app: 'FreeRPA',
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        versions: {
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.versions.node,
        },
        paths: {
          userData: app.getPath('userData'),
          documents: app.getPath('documents'),
          logs: app.getPath('logs'),
        },
        mcp: {
          enabled: settings.enabled,
          readOnly: settings.readOnly,
          tools: toolCount(),
          bridge: global.__freerpaMcpBridgeInfo || null,
        },
        uptimeSec: Math.floor(process.uptime()),
      };
    },
  });

  defineTool({
    name: 'system_status',
    title: '运行概览',
    description: '汇总当前运行中的工作流实例与已打开的浏览器实例，便于外部程序判断占用情况。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => ({
      runs: {
        running: listRuns({ status: 'running', limit: 100 }).length,
        starting: listRuns({ status: 'starting', limit: 100 }).length,
        recent: listRuns({ limit: 10 }),
      },
      browsers: getAllBrowserStatus(),
    }),
  });

  defineTool({
    name: 'plugin_list',
    title: '插件列表',
    description: '列出已安装插件（正式版 + 开发版，按插件 ID 合并）。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => listPlugins(),
  });

  defineTool({
    name: 'plugin_get',
    title: '插件详情',
    description:
      '按 identifier（pluginId@version 或 pluginId）获取插件清单与元信息。默认不返回执行器源码，需要时设 includeCode=true。',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string' },
        includeCode: { type: 'boolean', default: false },
      },
      required: ['identifier'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ identifier, includeCode = false }) => {
      const found = (await findPluginByIdentifier(identifier)) || (await findPlugin(identifier));
      if (!found) throw new Error(`插件不存在：${identifier}`);
      // 不直接删除源对象字段（manifest 读取结果可能被缓存/复用）
      if (includeCode) return found;
      const rest = { ...found };
      delete rest.executeCode;
      return rest;
    },
  });

  defineTool({
    name: 'setting_get',
    title: '读取配置',
    description: '读取一个配置项（等价于客户端配置中心的 key）。系统敏感配置不会返回。',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ key }) => {
      if (PROTECTED_KEYS.has(key)) throw new Error(`配置项受保护，不允许读取：${key}`);
      return { key, value: storeGet(key) ?? null };
    },
  });

  defineTool({
    name: 'setting_list',
    title: '配置列表',
    description: '列出全部可外部访问的配置项（排除权限、密钥、数据库、MCP 等系统配置）。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => {
      const all = storeList();
      const entries = Object.keys(all)
        .filter((key) => !PROTECTED_KEYS.has(key))
        .map((key) => ({ key, value: all[key] }));
      return { entries };
    },
  });

  defineTool({
    name: 'setting_set',
    title: '写入配置',
    description: '写入配置项（系统敏感配置被拒绝）。value 为任意 JSON 值。',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: {},
      },
      required: ['key', 'value'],
    },
    handler: async ({ key, value }) => {
      if (PROTECTED_KEYS.has(key)) throw new Error(`配置项受保护，不允许写入：${key}`);
      storeSet(key, value);
      return { success: true, key };
    },
  });

  defineTool({
    name: 'setting_remove',
    title: '删除配置',
    description: '删除配置项（系统敏感配置被拒绝）。需 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['key', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ key }) => {
      if (PROTECTED_KEYS.has(key)) throw new Error(`配置项受保护，不允许删除：${key}`);
      storeRemove(key);
      return { success: true, key };
    },
  });
};
