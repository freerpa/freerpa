/**
 * @file: 本地插件管理 IPC
 * @description: 插件目录管理 / 扫描 / 执行
 */
import { ipcMain, app, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
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
const scanPluginDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) return null
  const pluginJsonPath = path.join(dirPath, 'plugin.json')
  if (!fs.existsSync(pluginJsonPath)) return null

  try {
    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'))
    const executePath = path.join(dirPath, 'execute.js')
    const hasExecute = fs.existsSync(executePath)
    const pkgJsonPath = path.join(dirPath, 'package.json')
    const hasDeps = fs.existsSync(pkgJsonPath)

    return {
      id: path.basename(dirPath),
      dir: dirPath,
      name: pluginJson.name || path.basename(dirPath),
      version: pluginJson.version || '1.0.0',
      description: pluginJson.description || '',
      icon: pluginJson.icon || null,
      config: pluginJson.config || {},
      inputs: pluginJson.inputs || [],
      outputs: pluginJson.outputs || [],
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
          const info = scanPluginDir(pluginDir)
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
        const info = scanPluginDir(pluginDir)
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

  ipcMain.handle('plugin:resolvePath', async (_, pluginId) => {
    const dirs = getPluginDirs()
    for (const dir of dirs) {
      const pluginDir = path.join(dir, pluginId)
      if (fs.existsSync(pluginDir)) {
        const executePath = path.join(pluginDir, 'execute.js')
        if (fs.existsSync(executePath)) {
          return { path: executePath }
        }
      }
    }
    return { error: '插件未找到' }
  })

  ipcMain.handle('plugin:execute', async (_, { pluginId, node }) => {
    const dirs = getPluginDirs()
    let executePath = null
    for (const dir of dirs) {
      const pluginDir = path.join(dir, pluginId)
      const ep = path.join(pluginDir, 'execute.js')
      if (fs.existsSync(ep)) {
        executePath = ep
        break
      }
    }
    if (!executePath) return { error: '插件未找到: ' + pluginId }

    try {
      // 清除缓存以支持热更新
      const modPath = require.resolve(executePath)
      delete require.cache[modPath]
      const executeModule = require(executePath)
      const executeFn = executeModule.default || executeModule.execute || executeModule

      if (typeof executeFn !== 'function') {
        return { error: 'execute.js 未导出异步函数' }
      }

      // 创建 context 对象
      let resolved = false
      let resultOutputs = null

      const pluginContext = {
        nodeId: node.id,
        wait: (ms) => new Promise((r) => setTimeout(r, ms)),
        fs,
        path,
        complete: (outputs, isNext = true) => {
          resolved = true
          resultOutputs = outputs || {}
        },
        next: (outputs) => {
          resolved = true
          resultOutputs = outputs || {}
        }
      }

      await executeFn(node, pluginContext)
      return { success: true, outputs: resultOutputs || {} }
    } catch (e) {
      return { error: e.message }
    }
  })
}
