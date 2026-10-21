/**
 * @file: MCP 工具注册入口（主进程）
 */
import { registerWorkflowTools } from './workflow.js';
import { registerBrowserTools } from './browser.js';
import { registerDataTools } from './data.js';
import { registerSystemTools } from './system.js';
import { registerAgentTools } from './agent.js';

let registered = false;

export const registerAllTools = () => {
  if (registered) return;
  registered = true;
  registerWorkflowTools();
  registerBrowserTools();
  registerDataTools();
  registerSystemTools();
  registerAgentTools();
};
