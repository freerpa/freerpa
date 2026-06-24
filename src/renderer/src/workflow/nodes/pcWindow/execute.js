/**
 * @file: 剪切板操作节点执行器
 * @author: AutoMan
 * @date: 2025-07-30
 */
import { windowManager } from "node-window-manager";

const execute = async (node, context) => {
  const { config } = node
  const { complete, wait } = context

  try {
    const windows = await windowManager.getWindows()
    const window = windows.find((window) => window.id === config.window)
    if (!window) {
      throw new Error('窗口不存在')
    }
    window.bringToTop()
    complete({ window })
  } catch (error) {
    throw new Error('窗口操作节点执行错误', error)
  }
}

export default execute
