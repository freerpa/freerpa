/**
 * @file: 插件调用执行器（新安装式体系）
 * @description: 本地插件节点（plu_<插件id>）的统一执行器：在 worker 中加载并执行本地插件。
 *   布局：正式版 {pluginRoot}/{pluginId}@{version}/，开发版 {pluginId}@dev（目录经主进程注入的 devPluginDirs 定位，优先）。
 *
 * 新契约（唯一支持）：入口文件（package.json 的 main）导出 { config, inputs, outputs, execute }：
 *   - config/inputs/outputs：渲染端表单/连线展示用的描述（可含 onChange/remoteMethod 等函数钩子，
 *     由渲染进程经 plugin:// 协议 import 入口模块求值，不跨进程）。
 *   - execute(ctx)：运行逻辑，上下文由参数注入，ctx = { inputs, config, complete, next, wait, getOutputs, setOutputs }。
 *     每次执行传入独立的 ctx 闭包 ⇒ 天然支持任意并发，无需 AsyncLocalStorage / data-URL 重写 / 全局实例注册表。
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

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

/** 解析目录下 package.json（main 字段定位入口主文件），返回 { executePath, main, version } 或 null */
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

  const nodeIO = node.config?.__nodeIO || {}
  const inputs = node.inputs || nodeIO.inputs || {}
  const config = node.config || {}

  // 新契约：加载入口模块并调用 execute(ctx)。
  // 带唯一查询串强制每次全新模块实例 ⇒ 开发期改完入口即时生效，且并发执行互不共享模块状态。
  const uid = randomUUID()
  const mod = await import(pathToFileURL(plugin.executePath).href + '?v=' + uid)
  const executeFn = mod.execute
  if (typeof executeFn !== 'function') {
    throw new Error(`插件入口缺少 execute 导出（新契约要求入口导出 execute(ctx)）: ${identifier || pluginId}`)
  }

  // 上下文由参数注入：每次执行独立闭包，天然支持任意并发
  const pluginCtx = {
    inputs,
    config,
    complete: (outputs) => context.complete(outputs),
    next: (outputs) => context.next(outputs),
    wait: (ms) => context.wait(ms),
    getOutputs: () => context.getOutputs(),
    setOutputs: (outputs) => context.setOutputs(outputs)
  }
  const result = await executeFn(pluginCtx)
  // 便利：execute 返回普通对象且未显式输出时自动完成
  if (result && typeof result === 'object') {
    const currentOutputs = context.getOutputs()
    if (!currentOutputs || Object.keys(currentOutputs).length === 0) {
      context.complete(result)
    }
  }
}

export default execute
