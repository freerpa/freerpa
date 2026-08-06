/**
 * @file: 工作流执行 IPC（命令通道）
 *
 * 通道命名规则（与 preload 的 onFlowEvent/emitFlowEvent 拼接保持一致，见 src/preload/index.js）：
 *   flowEventBus:<event>[:<flowId>[:<nodeId>]]
 * 命令通道不带 flowId 后缀（flowId 作为参数传递）；事件通道（stateChange/nodeStatus/debug 等）带 flowId 后缀。
 */
import { ipcMain } from 'electron'
import { manager } from './index'

// 命令通道单点定义（渲染端经 preload emitFlowEvent(event, null, null, params) 拼出同名通道）
const CHANNELS = {
  createEngine: 'flowEventBus:createEngine',
  startFlow: 'flowEventBus:startFlow',
  stopFlow: 'flowEventBus:stopFlow',
  cleanup: 'flowEventBus:cleanup'
}

export const register = () => {
  // 创建工作流
  ipcMain.handle(CHANNELS.createEngine, async (event, data) => {
    try {
      await manager.createEngine(data)
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 执行工作流
  ipcMain.handle(CHANNELS.startFlow, async (event, flowId) => {
    try {
      const result = await manager.startFlow(flowId)
      return { success: true, ...result }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 停止工作流
  ipcMain.handle(CHANNELS.stopFlow, async (event, flowId) => {
    try {
      await manager.stopFlow(flowId)
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 清理工作流（解密 IPC 见 src/main/crypto.js，与工作流执行解耦）
  ipcMain.handle(CHANNELS.cleanup, async (event) => {
    manager.cleanup()
    return { success: true }
  })
}
