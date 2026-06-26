/**
 * @file: 浏览器管理IPC通信处理
 * @author: dabao
 * @date: 2024-03-16
 */
import { ipcMain, app } from 'electron'
import { get, set } from './index.js'
import path from 'path'

export const register = () => {
  // 设置默认安全目录
  if (!get('allowedRoot')) {
    set('allowedRoot', path.join(app.getPath('documents')))
  }
  // WebContentsView 相关
  ipcMain.handle('store:get', async (event, key) => {
    return get(key)
  })

  ipcMain.handle('store:set', async (event, key, value) => {
    return set(key, value)
  })
}
