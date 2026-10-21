/**
 * @file: MCP 浏览器工具（环境 CRUD + 运行时控制）
 * 浏览器环境即 FreeRPA 的「浏览器环境」记录；打开后是独立内核进程（Puppeteer 连接）。
 */
import {
  getBrowsers,
  getBrowser,
  createBrowser,
  updateBrowser,
  deleteBrowser,
  getTrashBrowsers,
  restoreBrowser,
  permanentDeleteBrowser,
} from '../../data/browsers/index.js';
import { launchEnvBrowser } from '../../browser/launch.js';
import {
  getAllBrowserStatus,
  getBrowserInstance,
  incrementRef,
  decrementRef,
  bringBrowserToFront,
} from '../../browser/manager.js';
import { defineTool } from '../registry.js';

export const registerBrowserTools = () => {
  defineTool({
    name: 'browser_list',
    title: '浏览器环境列表',
    description: '分页查询浏览器环境（不含回收站）。返回 id/name/description/kernel_id/proxy_url/config 等。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
      },
    },
    annotations: { readOnlyHint: true },
    handler: async ({ keyword = '', page = 1, pageSize = 20 }) => getBrowsers({ keyword, page, pageSize }),
  });

  defineTool({
    name: 'browser_get',
    title: '浏览器环境详情',
    description: '按 id 获取浏览器环境配置。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ id }) => {
      const env = await getBrowser(id);
      if (!env) throw new Error(`浏览器环境不存在：${id}`);
      return env;
    },
  });

  defineTool({
    name: 'browser_create',
    title: '创建浏览器环境',
    description: '创建浏览器环境。config 可存放自定义配置（如指纹、启动参数、无头模式等，结构由客户端定义）。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        category_id: { type: 'string' },
        kernel_id: { type: 'string', description: '浏览器内核 id（留空使用默认内核）' },
        proxy_url: { type: 'string', description: '代理地址，如 http://user:pass@host:port' },
        config: { type: 'object', description: '环境自定义配置' },
      },
      required: ['name'],
    },
    handler: async ({ name, description = '', category_id = '', kernel_id = '', proxy_url = '', config = {} }) => {
      const id = await createBrowser({ name, description, category_id, kernel_id, proxy_url, config });
      return { id, name };
    },
  });

  defineTool({
    name: 'browser_update',
    title: '更新浏览器环境',
    description: '更新浏览器环境配置（只传需要修改的字段）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        category_id: { type: 'string' },
        kernel_id: { type: 'string' },
        proxy_url: { type: 'string' },
        config: { type: 'object' },
      },
      required: ['id'],
    },
    handler: async (payload) => {
      const existing = await getBrowser(payload.id);
      if (!existing) throw new Error(`浏览器环境不存在：${payload.id}`);
      await updateBrowser(payload);
      return { success: true, id: payload.id };
    },
  });

  defineTool({
    name: 'browser_delete',
    title: '删除浏览器环境（移入回收站）',
    description: '软删除浏览器环境（同时清理会话目录），可恢复。需 confirm=true。',
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
      await deleteBrowser(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'browser_restore',
    title: '恢复浏览器环境',
    description: '从回收站恢复浏览器环境。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      await restoreBrowser(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'browser_permanent_delete',
    title: '彻底删除浏览器环境',
    description: '从回收站彻底删除（含会话目录），不可恢复。需 confirm=true。',
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
      await permanentDeleteBrowser(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'browser_trash_list',
    title: '回收站浏览器环境',
    description: '列出回收站中的浏览器环境。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => getTrashBrowsers(),
  });

  // ─── 运行时控制 ───────────────────────────────────────

  defineTool({
    name: 'browser_open',
    title: '打开浏览器环境',
    description:
      '启动浏览器实例并返回 wsEndpoint（可被 Puppeteer 直接连接）。已打开时复用现有实例。randomFingerprint=true 时先关闭旧实例再以随机指纹全新启动。',
    inputSchema: {
      type: 'object',
      properties: {
        envId: { type: 'string', description: '浏览器环境 id' },
        proxy: { type: 'string', description: '覆盖代理（空则用环境配置）' },
        width: { type: 'integer', description: '窗口宽度' },
        height: { type: 'integer', description: '窗口高度' },
        randomFingerprint: { type: 'boolean', default: false },
      },
      required: ['envId'],
    },
    handler: async ({ envId, proxy = '', width, height, randomFingerprint = false }) => {
      const env = await getBrowser(envId);
      if (!env) throw new Error(`浏览器环境不存在：${envId}`);
      const sender = global.mainView?.webContents;
      const instance = await launchEnvBrowser({
        envId,
        proxy: proxy || env.proxy_url || '',
        width,
        height,
        randomFingerprint,
        sender,
      });
      incrementRef(envId);
      return {
        success: true,
        envId: String(envId),
        instanceId: String(instance.id),
        port: Number(instance.port),
        wsEndpoint: String(instance.wsEndpoint),
      };
    },
  });

  defineTool({
    name: 'browser_close',
    title: '关闭浏览器环境',
    description: '关闭浏览器实例并释放引用计数（引用归零时进程退出）。',
    inputSchema: {
      type: 'object',
      properties: { envId: { type: 'string' } },
      required: ['envId'],
    },
    handler: async ({ envId }) => {
      await decrementRef(envId);
      return { success: true, envId };
    },
  });

  defineTool({
    name: 'browser_status',
    title: '浏览器运行状态',
    description: '列出当前已打开的浏览器实例（端口、wsEndpoint、PID、无头模式等）。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => getAllBrowserStatus(),
  });

  defineTool({
    name: 'browser_focus',
    title: '置顶浏览器窗口',
    description: '把已打开的浏览器窗口置顶显示（无头模式跳过）。',
    inputSchema: {
      type: 'object',
      properties: { envId: { type: 'string' } },
      required: ['envId'],
    },
    handler: async ({ envId }) => {
      const entry = getBrowserInstance(envId);
      if (!entry) throw new Error('浏览器未打开');
      if (entry.headless) return { success: true, skipped: true, message: '无头模式无窗口显示' };
      await bringBrowserToFront(entry.process?.pid);
      return { success: true };
    },
  });
};
