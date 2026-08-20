/**
 * @file: 本地插件管理 IPC（安装式体系）
 *  - 安装 .frp / 卸载 / 开发版导入 / 打包 / 列表查询
 *  - 安装与打包进度经 webContents 事件（plugin:progress）推送，渲染端进度条展示
 */
import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { getPluginRoot } from './store.js'
import { findPluginByIdentifier, findPlugin, listPlugins } from './manifest.js'
import { installFrp, uninstallPlugin, importDevPlugin, parseIdentifier } from './install.js'
import { packFrp } from './pack.js'

const sendProgress = (event, percent, label) => {
  event.sender.send('plugin:progress', { percent, label })
}

export const register = () => {
  // 插件列表（正式版 + 开发版，按插件 ID 合并）
  ipcMain.handle('plugin:list', async () => listPlugins())

  // 单插件详情（附执行器源码，供配置面板展示）：按 identifier(pluginId@version) 定位
  ipcMain.handle('plugin:get', async (_, identifier) => {
    const found = await findPluginByIdentifier(identifier) || await findPlugin(identifier)
    if (!found) return null
    if (found.executePath && fs.existsSync(found.executePath)) {
      found.executeCode = fs.readFileSync(found.executePath, 'utf-8')
    }
    return found
  })

  // 插件根目录（userData/plugin）
  ipcMain.handle('plugin:getRoot', async () => getPluginRoot())

  // 安装 .frp：选择文件 → 解压到 {pluginRoot}/{pluginId}@{version}/
  ipcMain.handle('plugin:installFrp', async (event) => {
    const result = await dialog.showOpenDialog({
      title: '选择插件安装包 (.frp)',
      filters: [{ name: 'FreeRPA 插件包', extensions: ['frp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths?.length) return { canceled: true }
    try {
      const installed = await installFrp(result.filePaths[0], (percent, label) =>
        sendProgress(event, percent, label)
      )
      return { success: true, ...installed }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 导入开发版插件：选择外部目录（含 package.json），仅记录挂载，不复制
  ipcMain.handle('plugin:importDev', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择开发版插件目录（含 package.json）',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths?.length) return { canceled: true }
    try {
      const dev = await importDevPlugin(result.filePaths[0])
      return { success: true, ...dev }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 打包 .frp：编译依赖最小化 + 压缩为 zip
  ipcMain.handle('plugin:packFrp', async (event, srcDir) => {
    const defaultName = srcDir ? `${path.basename(srcDir)}.frp` : 'plugin.frp'
    const result = await dialog.showSaveDialog({
      title: '打包插件为 .frp',
      defaultPath: defaultName,
      filters: [{ name: 'FreeRPA 插件包', extensions: ['frp'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    try {
      const packed = await packFrp(srcDir, result.filePath, (percent, label) =>
        sendProgress(event, percent, label)
      )
      return { success: true, ...packed }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 卸载：pluginId 必填；version 缺省卸载全部版本，'dev' 仅删挂载记录
  ipcMain.handle('plugin:uninstall', async (_, pluginId, version) => {
    try {
      const res = await uninstallPlugin(pluginId, version)
      return { success: true, ...res }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })
}
