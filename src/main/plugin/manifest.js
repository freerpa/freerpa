/**
 * @file: 插件描述解析与目录扫描（manifest 单点解析）
 *
 * 目录约定：{插件根目录}/{pluginId}/，含 index.js（描述模块）与可选的 execute.js（执行器）。
 * 描述模块兼容多层导出结构：ESM default / CommonJS module.exports /
 * {default:{...}}（TS/Babel 产物）/ 命名导出。
 *
 * 注意：渲染端节点注册与配置面板消费的是本模块返回的归一结构
 * （name/version/config/inputs/outputs 等），不要再各自解包描述模块。
 */
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { getPluginDirs } from './store.js'

/** 解包描述模块 default 导出（最多 3 层），返回归一后的插件定义对象 */
function unwrapDefault(pluginModule) {
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
  return pluginDef && typeof pluginDef === 'object' ? pluginDef : pluginModule
}

/**
 * 扫描单个插件目录，返回归一插件信息。
 * 目录不存在 / 无 index.js / 解析失败均不抛出（解析失败返回含 error 字段的对象）。
 */
export async function scanPluginDir(dirPath) {
  if (!fs.existsSync(dirPath)) return null
  const indexPath = path.join(dirPath, 'index.js')
  if (!fs.existsSync(indexPath)) return null

  try {
    const pluginDef = unwrapDefault(await import(pathToFileURL(indexPath).href))
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
    return { id: path.basename(dirPath), dir: dirPath, error: e.message }
  }
}

/**
 * 扫描所有已配置目录下的插件，跳过不存在的/不可读的目录；
 * 目录名 = 插件 ID 须全局唯一，重复 ID 的插件被标记 duplicate（渲染端提示）
 */
export async function listPlugins() {
  const plugins = []
  const seen = new Map() // id → 首个插件信息
  for (const dir of getPluginDirs()) {
    if (!fs.existsSync(dir)) continue
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (e) {
      console.warn(`⚠ 插件目录不可读，已跳过: ${dir}（${e.message}）`)
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const info = await scanPluginDir(path.join(dir, entry.name))
      if (!info) continue
      if (seen.has(info.id)) {
        info.duplicate = true
        info.duplicateOf = seen.get(info.id).dir
        console.warn(`⚠ 插件 ID 重复（目录名须全局唯一）: "${info.id}" 同时存在于 ${seen.get(info.id).dir} 与 ${info.dir}`)
      } else {
        seen.set(info.id, info)
      }
      plugins.push(info)
    }
  }
  return plugins
}

/** 按 pluginId 查找插件（取第一个匹配目录），返回 {dir, info} 或 null */
export async function findPlugin(pluginId) {
  for (const dir of getPluginDirs()) {
    const pluginDir = path.join(dir, pluginId)
    if (fs.existsSync(pluginDir)) {
      const info = await scanPluginDir(pluginDir)
      if (info) return { dir: pluginDir, info }
    }
  }
  return null
}
