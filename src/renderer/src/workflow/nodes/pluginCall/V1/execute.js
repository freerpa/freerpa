/**
 * @file: 插件调用执行器（新安装式体系）
 * @description: 本地插件节点（plu_<插件id>）的统一执行器：在 worker 中加载并执行本地插件。
 *   布局：正式版 {pluginRoot}/{pluginId}@{version}/，开发版 {pluginId}@dev（目录经主进程注入的 devPluginDirs 定位，优先）。
 *   执行：读 package.json 的 main 字段定位执行器主文件，import 加载；插件经 `import {inputs,config,complete,next,wait} from 'freerpa'`
 *         （worker import-map 映射 freerpa-runtime.js）获取运行上下文。插件模块顶层执行逻辑（支持顶层 await），
 *         也兼容 default 导出函数。
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { __setRuntimeContext } from 'freerpa'

/** 解析正式版目录名：{pluginId}@{version} */
const parsePluginDirName = (name) => {
  const at = name.lastIndexOf('@')
  if (at <= 0 || at === name.length - 1) return null
  return { pluginId: name.slice(0, at), version: name.slice(at + 1) }
}

/** semver 数字序列比较（1 / 1.2 / 1.2.3） */
const compareSemver = (a, b) => {
  const pa = String(a ?? '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b ?? '').split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va !== vb) return va > vb ? 1 : -1
  }
  return 0
}

/** 解析目录下 package.json（main 字段定位执行器主文件），返回 { executePath, main, version } 或 null */
const resolveDirPackage = (dir) => {
  const pkgPath = path.join(dir, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch {
    return null
  }
  const main = pkg.main || './src/index.js'
  const executePath = path.resolve(dir, main)
  if (!fs.existsSync(executePath)) return null
  return { executePath, main, version: String(pkg.version || '') }
}

/** 在开发版挂载目录中按 package.json name 匹配插件 */
const findDevPlugin = (devDirs, pluginId) => {
  for (const dir of devDirs || []) {
    const pkgPath = path.join(dir, 'package.json')
    if (!fs.existsSync(pkgPath)) continue
    let pkg
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    } catch {
      continue
    }
    if (String(pkg.name || '') !== pluginId) continue
    const resolved = resolveDirPackage(dir)
    if (resolved) return { ...resolved, dir }
  }
  return null
}

/** 在正式插件根目录下精确匹配 {pluginId}@{version} 目录 */
const findInstalledVersion = (pluginRoots, pluginId, version) => {
  for (const root of pluginRoots || []) {
    if (!fs.existsSync(root)) continue
    const dir = path.join(root, `${pluginId}@${version}`)
    if (!fs.existsSync(dir)) continue
    const resolved = resolveDirPackage(dir)
    if (resolved) return { ...resolved, dir }
  }
  return null
}

/** 在正式插件根目录下扫描 {pluginId}@*，取 semver 最高版本 */
const findInstalledPlugin = (pluginRoots, pluginId) => {
  let best = null
  for (const root of pluginRoots || []) {
    if (!fs.existsSync(root)) continue
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const parsed = parsePluginDirName(entry.name)
      if (!parsed || parsed.pluginId !== pluginId) continue
      const resolved = resolveDirPackage(path.join(root, entry.name))
      if (!resolved) continue
      if (!best || compareSemver(resolved.version, best.version) > 0) best = { ...resolved, dir: path.join(root, entry.name) }
    }
  }
  return best
}

const execute = async (node, context) => {
  const pluginId = node.config?.pluginId
  const identifier = node.config?._pluginIdentifier || node.config?.identifier
  if (!pluginId && !identifier) throw new Error('未选择插件')

  const devDirs = context.engine?.devPluginDirs || []
  const pluginRoots = context.engine?.pluginRoots || []

  // 按 identifier 精确定位（每个版本独立节点：plu_{pluginId}@{version}）
  let plugin = null
  if (identifier) {
    const at = identifier.lastIndexOf('@')
    const id = at > 0 ? identifier.slice(0, at) : pluginId
    const ver = at > 0 ? identifier.slice(at + 1) : ''
    if (ver === 'dev') {
      plugin = findDevPlugin(devDirs, id)
    } else if (ver) {
      plugin = findInstalledVersion(pluginRoots, id, ver)
    }
  }
  // 回退：仅有 pluginId 的旧节点 → dev 优先 / 最高版本
  if (!plugin) {
    plugin = findDevPlugin(devDirs, pluginId) || findInstalledPlugin(pluginRoots, pluginId)
  }
  if (!plugin) throw new Error('插件未找到: ' + (identifier || pluginId))

  // 注入 freerpa 运行上下文（插件 import 'freerpa' 后顶层即可读取）
  const nodeIO = node.config?.__nodeIO || {}
  const inputs = node.inputs || nodeIO.inputs || {}
  const config = node.config || {}
  __setRuntimeContext({
    inputs,
    config,
    complete: (outputs) => context.complete(outputs),
    next: (outputs) => context.next(outputs),
    wait: (ms) => context.wait(ms)
  })

  // 每次执行强制新模块实例（顶层逻辑重新执行；带 query 绕过模块缓存）
  const url = pathToFileURL(plugin.executePath).href + '?v=' + Date.now()
  const mod = await import(url)

  // 兼容 default 导出函数：调用并按其返回值自动完成
  const executeFn = mod.default
  if (typeof executeFn === 'function') {
    const result = await executeFn({ inputs, config })
    if (result && typeof result === 'object') {
      const currentOutputs = context.getOutputs()
      if (!currentOutputs || Object.keys(currentOutputs).length === 0) {
        context.complete(result)
      }
    }
  }
  // 顶层执行逻辑：import resolve 即完成（含顶层 await）；插件经 complete()/next() 与工作流交互
}

export default execute
