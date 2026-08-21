/**
 * @file: 插件安装 / 卸载 / 开发版导入
 *  - 安装 .frp：解压 zip 到 {pluginRoot}/{pluginId}@{version}/（同版本覆盖安装）
 *  - 卸载：删除正式版目录；开发版删除挂载记录
 *  - 开发版导入：校验外部目录 package.json 后写入挂载记录（不复制进 plugin 根目录）
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import AdmZip from 'adm-zip'
import { getPluginRoot, pluginDirName, addDevPlugin, removeDevPlugin } from './store.js'
import { readPluginPackage } from './manifest.js'

/** 包内 package.json 是否位于包根（而非单层包裹目录） */
function locatePackageRoot(zip) {
  const names = zip.getEntries().map((e) => e.entryName.replace(/\/$/, ''))
  if (names.includes('package.json')) return ''
  // 单层包裹目录：全部条目共享同一顶层目录且该目录下有 package.json
  const top = new Set(names.map((n) => n.split('/')[0]))
  if (top.size === 1) {
    const prefix = [...top][0]
    if (names.includes(`${prefix}/package.json`)) return `${prefix}/`
  }
  return null
}

/**
 * 解压 .frp 到临时目录并定位包根，返回 { tmpDir, packageRoot, pkg }。
 * 校验 package.json 可解析、name 非空、version 为数字序列。
 */
export async function inspectFrp(filePath) {
  const zip = new AdmZip(filePath)
  const packageRoot = locatePackageRoot(zip)
  if (packageRoot === null) {
    throw new Error('.frp 内容不合法：缺少 package.json')
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frp-'))
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const rel = entry.entryName
    // 防路径穿越
    const norm = rel.split('/').filter((s) => s && s !== '.' && s !== '..').join('/')
    const abs = path.join(tmpDir, norm)
    if (!abs.startsWith(tmpDir + path.sep)) throw new Error(`非法文件路径: ${rel}`)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, entry.getData())
  }
  const pkgDir = path.join(tmpDir, packageRoot)
  const pkg = readPluginPackage(pkgDir)
  if (!pkg || pkg.error) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    throw new Error(pkg?.error || '.frp 内容不合法')
  }
  if (!/^\d+(\.\d+)*$/.test(pkg.version)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    throw new Error(`插件版本号不合法: ${pkg.version}`)
  }
  return { tmpDir, packageRoot, pkg }
}

/**
 * 安装 .frp 到插件根目录。onProgress(percent, label) 用于进度条展示。
 * 同版本已存在时覆盖（升级/重装场景）。
 */
export async function installFrp(filePath, onProgress = () => {}) {
  const { tmpDir, packageRoot, pkg } = await inspectFrp(filePath)
  try {
    const root = getPluginRoot()
    fs.mkdirSync(root, { recursive: true })
    const target = path.join(root, pluginDirName(pkg.pluginId, pkg.version))
    // 覆盖安装：清空旧目录
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
    fs.cpSync(path.join(tmpDir, packageRoot), target, { recursive: true })
    onProgress(100, '安装完成')
    return { pluginId: pkg.pluginId, version: pkg.version, dir: target }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/** 解析 identifier：{pluginId}@{version} / {pluginId}@dev → { pluginId, version, isDev }；无效返回 null */
export function parseIdentifier(identifier) {
  if (!identifier) return null
  const at = identifier.lastIndexOf('@')
  if (at <= 0 || at === identifier.length - 1) return null
  return {
    pluginId: identifier.slice(0, at),
    version: identifier.slice(at + 1),
    isDev: identifier.slice(at + 1) === 'dev'
  }
}

/** 卸载插件：identifier 指定具体版本（dev 删挂载，版本号删目录）；仅 pluginId 时卸载全部版本 */
export async function uninstallPlugin(pluginId, version) {
  // 兼容按 identifier（pluginId@version / pluginId@dev）卸载
  if (version === undefined && pluginId && pluginId.includes('@')) {
    const parsed = parseIdentifier(pluginId)
    if (parsed) {
      pluginId = parsed.pluginId
      version = parsed.version
    }
  }
  const root = getPluginRoot()
  if (version && version !== 'dev') {
    const dir = path.join(root, pluginDirName(pluginId, version))
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    return { pluginId, version }
  }
  if (version === 'dev') {
    removeDevPlugin(pluginId)
    return { pluginId, version: 'dev' }
  }
  // 卸载全部版本：删除 {pluginId}@* 目录 + 开发版挂载记录
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith(`${pluginId}@`)) {
        fs.rmSync(path.join(root, entry.name), { recursive: true, force: true })
      }
    }
  }
  removeDevPlugin(pluginId)
  return { pluginId }
}

/**
 * 导入开发版插件（外部目录）：校验 package.json（name/version），写入挂载记录，不复制目录。
 */
export async function importDevPlugin(dir) {
  const pkg = readPluginPackage(dir)
  if (!pkg || pkg.error) throw new Error(pkg?.error || '目录下缺少可用的 package.json')
  if (!/^\d+(\.\d+)*$/.test(pkg.version)) {
    throw new Error(`插件版本号不合法: ${pkg.version}`)
  }
  addDevPlugin({ pluginId: pkg.pluginId, path: path.resolve(dir), importedAt: Date.now() })
  return { pluginId: pkg.pluginId, version: 'dev', dir: path.resolve(dir) }
}
