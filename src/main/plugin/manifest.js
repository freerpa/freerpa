/**
 * @file: 插件元数据解析与列表（新安装式体系，推翻旧目录发现机制）
 *
 * 布局：
 *   - 正式版：{userData}/plugin/{pluginId}@{version}/package.json
 *   - 开发版：外部目录挂载（store.js 挂载记录），识别码 {pluginId}@dev
 *
 * 元数据统一来自 package.json（标准 npm 项目）：
 *   name=插件ID、version=版本、description=简介、main=执行器主文件（相对 package.json）
 *   freerpa=<最低客户端版本>（字符串，如 "1.0.0"；插件所需的客户端最低版本，打包时自动填充）
 *
 * 开发版优先原则：同一插件 ID 存在开发版时，执行与展示均以开发版为准（验证/调试场景）。
 */
import fs from 'fs'
import path from 'path'
import { getPluginRoot, getDevPlugins } from './store.js'
import { compareSemver } from '../utils.js'

/** 解析正式版目录名：{pluginId}@{version}；不满足返回 null */
export function parsePluginDirName(dirName) {
  const at = dirName.lastIndexOf('@')
  if (at <= 0 || at === dirName.length - 1) return null
  return { pluginId: dirName.slice(0, at), version: dirName.slice(at + 1) }
}

/**
 * 读取并解析目录下的 package.json，返回归一插件信息；目录不存在/无 package.json 返回 null，
 * JSON 解析失败或缺少 name 返回含 error 的对象。
 */
export function readPluginPackage(dir) {
  const pkgPath = path.join(dir, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch (e) {
    return { pluginId: path.basename(dir), dir, error: `package.json 解析失败: ${e.message}` }
  }
  const pluginId = String(pkg.name || '').trim()
  if (!pluginId) {
    return { pluginId: path.basename(dir), dir, error: 'package.json 缺少 name（插件 ID）' }
  }
  // freerpa 直接表示插件所需的最低客户端版本（字符串，如 "1.0.0"），不再承载 IO 声明
  const clientVersion = typeof pkg.freerpa === 'string' ? pkg.freerpa : ''
  const main = String(pkg.main || './src/index.js')
  const executePath = path.resolve(dir, main)
  // 节点契约（config/inputs/outputs）统一来自入口主文件：渲染端经 plugin:// 协议加载入口模块解出（可含函数钩子）
  return {
    pluginId,
    name: String(pkg.name || pluginId),
    version: String(pkg.version || ''),
    description: String(pkg.description || ''),
    main,
    executePath,
    hasExecute: fs.existsSync(executePath),
    config: [],
    inputs: [],
    outputs: [],
    clientVersion,
    packageJson: pkg
  }
}

/**
 * 列出全部已安装条目（正式版每版本一条 + 开发版每条）：
 *   { pluginId, identifier, version('dev'|semver), dir, isDev, ...readPluginPackage 字段 }
 * 解析失败的条目保留 error（渲染端提示）。
 */
export async function listPluginEntries() {
  const entries = []
  // 正式版：扫描 {pluginRoot} 下 {pluginId}@{version} 目录
  const root = getPluginRoot()
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const parsed = parsePluginDirName(entry.name)
      if (!parsed) continue
      const info = readPluginPackage(path.join(root, entry.name))
      if (!info) continue
      entries.push({
        ...info,
        pluginId: parsed.pluginId,
        version: parsed.version,
        identifier: entry.name,
        dir: path.join(root, entry.name),
        isDev: false
      })
    }
  }
  // 开发版：读挂载记录
  for (const rec of getDevPlugins()) {
    if (!rec?.pluginId || !rec?.path) continue
    const info = readPluginPackage(rec.path)
    if (!info) continue
    entries.push({
      ...info,
      pluginId: rec.pluginId,
      version: 'dev',
      identifier: `${rec.pluginId}@dev`,
      dir: rec.path,
      isDev: true
    })
  }
  return entries
}

/**
 * 列出全部已安装插件条目（不合并）：正式版每版本一条 + 开发版每条（identifier=pluginId@dev）。
 * 开发版与正式版、以及不同正式版版本全部共存，互不覆盖。
 */
export async function listPlugins() {
  return listPluginEntries()
}

/** 按 identifier（pluginId@version / pluginId@dev）精确定位插件，返回条目或 null */
export async function findPluginByIdentifier(identifier) {
  if (!identifier) return null
  const entries = await listPluginEntries()
  return entries.find((e) => e.identifier === identifier) || null
}

/** 按 pluginId 查找（兼容旧调用）：返回该 id 的 dev（若有）或最高版本单条目 */
export async function findPlugin(pluginId) {
  const entries = await listPluginEntries()
  const same = entries.filter((e) => e.pluginId === pluginId)
  if (same.length === 0) return null
  const dev = same.find((e) => e.isDev)
  if (dev) return dev
  return same.reduce((a, b) => (compareSemver(b.version, a.version) > 0 ? b : a), same[0])
}
