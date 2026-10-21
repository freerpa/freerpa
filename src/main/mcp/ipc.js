/**
 * @file: MCP 设置 IPC（渲染进程设置中心 ↔ 主进程桥接）
 */
import { ipcMain, app } from 'electron';
import { set as storeSet } from '../store/index.js';
import { startMcpBridge, stopMcpBridge, getBridgeInfo, isBridgeRunning, buildClientConfig } from './bridge.js';
import { mcpSettings, readAuditTail, toolCount, listTools } from './registry.js';

const statusOf = () => {
  const info = getBridgeInfo();
  const settings = mcpSettings();
  return {
    enabled: settings.enabled,
    readOnly: settings.readOnly,
    running: isBridgeRunning(),
    host: info?.host || '127.0.0.1',
    port: info?.port || null,
    requestedPort: info?.requestedPort ?? settings.port,
    portFallback: info?.portFallback || null,
    pid: info?.pid || null,
    toolCount: toolCount(),
    appVersion: app.getVersion(),
    bridgeFile: buildClientConfig().bridgeFile,
  };
};

export const register = () => {
  ipcMain.handle('mcp:getStatus', async () => statusOf());

  ipcMain.handle('mcp:setSettings', async (_e, patch = {}) => {
    const current = mcpSettings();
    let port = current.port;
    if (patch.port !== undefined) {
      port = Number(patch.port);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('端口必须为 0（自动分配）或 1-65535 之间的整数');
      }
    }
    const next = {
      enabled: patch.enabled === undefined ? current.enabled : !!patch.enabled,
      readOnly: patch.readOnly === undefined ? current.readOnly : !!patch.readOnly,
      port,
    };
    storeSet('mcp', next);
    // 端口变更需要重启桥接才能生效
    if (!next.enabled) await stopMcpBridge();
    else if (port !== current.port && isBridgeRunning()) {
      await stopMcpBridge();
      await startMcpBridge();
    } else await startMcpBridge();
    return statusOf();
  });

  ipcMain.handle('mcp:getConfig', async () => buildClientConfig());

  ipcMain.handle('mcp:listTools', async () => listTools());

  ipcMain.handle('mcp:getAudit', async (_e, limit = 50) => readAuditTail(limit));

  // 重新生成 Token：外部程序需要同步更新配置（关闭再启动）
  ipcMain.handle('mcp:regenerateToken', async () => {
    await stopMcpBridge();
    const info = await startMcpBridge();
    return { ...statusOf(), token: info?.token || null };
  });
};
