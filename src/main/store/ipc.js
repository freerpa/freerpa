/**
 * @file: 浏览器管理IPC通信处理
 * @author: dabao
 * @date: 2024-03-16
 */
import { ipcMain, app } from 'electron'
import { get, set, list, remove } from './index.js'
import path from 'path'

// 系统内部配置 key（有专门管理界面或由程序内部维护）：配置中心不展示、不可操作
const SYSTEM_KEYS = ['permissions', 'aiProviders', 'networkServer', 'allowedRoot', 'dbPath']

export const register = () => {
  // 设置默认安全目录
  if (!get('allowedRoot')) {
    set('allowedRoot', path.join(app.getPath('documents')))
  }
  // WebContentsView 相关
  ipcMain.handle('store:get', async (event, key) => {
    return get(key)
  })

  // 危险 key 黑名单（原型污染）：拒绝以这些为 key 的写入
  const isUnsafeKey = (key) =>
    key === '__proto__' || key === 'constructor' || key === 'prototype'

  ipcMain.handle('store:set', async (event, key, value) => {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new Error('配置 key 不能为空')
    }
    if (isUnsafeKey(key)) {
      throw new Error(`非法配置 key: ${key}`)
    }
    return set(key, value)
  })

  // 配置中心：列出全部（排除系统内部 key）
  ipcMain.handle('store:list', async () => {
    const all = list()
    const entries = {}
    for (const k of Object.keys(all)) {
      if (!SYSTEM_KEYS.includes(k)) entries[k] = all[k]
    }
    return entries
  })

  // 配置中心：删除（系统内部 key 拒绝删除）
  ipcMain.handle('store:remove', async (event, key) => {
    if (!key || SYSTEM_KEYS.includes(key)) return { success: false, error: '系统配置不可删除' }
    remove(key)
    return { success: true }
  })
}
