/**
 * @file: 本地插件管理 IPC
 * @description: 插件目录管理 / 扫描 / 信息查询
 *   - 目录存储见 store.js，描述解析/扫描见 manifest.js
 */
import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { addPluginDir, getPluginDirs, removePluginDir } from './store.js'
import { findPlugin, listPlugins } from './manifest.js'

export const register = () => {
  ipcMain.handle('plugin:addDir', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择插件目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths?.length) return { canceled: true }
    const dir = result.filePaths[0]
    addPluginDir(dir)
    return { success: true, dir }
  })

  ipcMain.handle('plugin:removeDir', async (_, dir) => {
    removePluginDir(dir)
    return { success: true }
  })

  ipcMain.handle('plugin:getDirs', async () => {
    return getPluginDirs()
  })

  ipcMain.handle('plugin:list', async () => {
    return listPlugins()
  })

  ipcMain.handle('plugin:get', async (_, pluginId) => {
    const found = await findPlugin(pluginId)
    if (!found) return null
    // 附上 execute.js 源码（供渲染端配置面板展示）
    if (found.info.hasExecute) {
      found.info.executeCode = fs.readFileSync(path.join(found.dir, 'execute.js'), 'utf-8')
    }
    return found.info
  })
}
