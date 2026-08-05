/**
 * @file: data IPC 注册助手 — 收敛各子模块 register() 的 try/catch 样板
 */
import { ipcMain } from 'electron'

export const handleCrud = (channel, fn) => {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return await fn(...args)
    } catch (e) {
      console.error(`[${channel}]`, e)
      throw e
    }
  })
}
