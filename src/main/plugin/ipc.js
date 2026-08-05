/**
 * @file: 本地插件管理 IPC
 * @description: 插件目录管理 / 扫描 / 信息查询
 */
import { ipcMain, app, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { get, set } from '../store/index.js'

const STORE_KEY = 'pluginDirs'

const getPluginDirs = () => get(STORE_KEY) || []

const addPluginDir = (dir) => {
  const dirs = getPluginDirs()
  if (!dirs.includes(dir)) {
    dirs.push(dir)
    set(STORE_KEY, dirs)
  }
  return dirs
}

const removePluginDir = (dir) => {
  const dirs = getPluginDirs().filter((d) => d !== dir)
  set(STORE_KEY, dirs)
  return dirs
}

/** 扫描单个插件目录，返回插件信息 */
const scanPluginDir = async (dirPath) => {
  if (!fs.existsSync(dirPath)) return null
  const indexPath = path.join(dirPath, 'index.js')
  if (!fs.existsSync(indexPath)) return null

  try {
    // 使用动态 import() 方式加载插件描述模块
    // 兼容多层导出结构：ESM default / CommonJS module.exports /
    // {default:{...}}（TS/Babel 产物）/ 命名导出（export const name = ...）
    const pluginModule = await import(pathToFileURL(indexPath).href)
    let pluginDef = pluginModule.default
    let depth = 0
    while (
      pluginDef &&
      typeof pluginDef === 'object' &&
      pluginDef.name === undefined &&
      pluginDef.default &&
      typeof pluginDef.default === 'object' &&
      depth < 3
    ) {
      pluginDef = pluginDef.default
      depth++
    }
    if (!pluginDef || typeof pluginDef !== 'object') {
      pluginDef = pluginModule
    }

    const executePath = path.join(dirPath, 'execute.js')
    const hasExecute = fs.existsSync(executePath)
    const pkgJsonPath = path.join(dirPath, 'package.json')
    const hasDeps = fs.existsSync(pkgJsonPath)

    return {
      id: path.basename(dirPath),
      dir: dirPath,
      name: pluginDef.name || path.basename(dirPath),
      version: pluginDef.version || '1.0.0',
      description: pluginDef.description || '',
      icon: pluginDef.icon || null,
      config: pluginDef.config || {},
      inputs: pluginDef.inputs || [],
      outputs: pluginDef.outputs || [],
      hasExecute,
      hasDeps,
      packageJson: hasDeps ? JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) : null
    }
  } catch (e) {
    return {
      id: path.basename(dirPath),
      dir: dirPath,
      error: e.message
    }
  }
}

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
    const dirs = getPluginDirs()
    const plugins = []
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        // 忽略不存在的目录
        continue
      }
      // 扫描目录下的所有子目录作为插件
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginDir = path.join(dir, entry.name)
          const info = await scanPluginDir(pluginDir)
          if (info) plugins.push(info)
        }
      }
    }
    return plugins
  })

  ipcMain.handle('plugin:get', async (_, pluginId) => {
    const dirs = getPluginDirs()
    for (const dir of dirs) {
      const pluginDir = path.join(dir, pluginId)
      if (fs.existsSync(pluginDir)) {
        const info = await scanPluginDir(pluginDir)
        if (info) {
          // 读取 execute.js 内容
          const executePath = path.join(pluginDir, 'execute.js')
          if (info.hasExecute) {
            info.executeCode = fs.readFileSync(executePath, 'utf-8')
          }
          return info
        }
      }
    }
    return null
  })
}
