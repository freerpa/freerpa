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
import { randomUUID } from 'node:crypto'

/**
 * 实例级运行时（data URL，闭包绑定，无需 AsyncLocalStorage）：
 * 每个执行实例独立生成一个 runtime 模块，其 complete/next/wait/inputs/config
 * 在模块顶层同步读取 globalThis 注册表中「本实例」的回调并闭包捕获。
 * 插件经重写后的 import 解析到它，从而彻底摆脱动态 import + 顶层 await 场景下
 * AsyncLocalStorage 上下文传播不可靠导致的并发限制。
 */
const buildInstanceRuntime = (id) => {
  const runSource = [
    `const __i = globalThis.__freerpaInstances[${JSON.stringify(id)}];`,
    `export const complete = (o) => __i.complete(o);`,
    `export const next = (o) => __i.next(o);`,
    `export const wait = (ms) => __i.wait(ms);`,
    `export const inputs = __i.inputs;`,
    `export const config = __i.config;`
  ].join('\n')
  return 'data:text/javascript;base64,' + btoa(runSource)
}

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

  // ‖ 每个执行实例独立隔离：不再用 AsyncLocalStorage（Deno 中动态 import + 顶层 await
  // ‖ 场景下其上下文传播不可靠，导致最多只能并发 2 个插件）。改为「每实例闭包绑定」：
  // ‖  1) globalThis.__freerpaInstances[id] 持有本实例的 complete/next/wait/inputs/config 回调；
  // ‖  2) 生成一个 data URL 形式的实例级 runtime 模块，闭包捕获 uid 并读取该实例回调；
  // ‖  3) 复制插件源码到临时 proxy 文件，把 `from "freerpa"` 重写为指向实例级 runtime，
  // ‖     再 import 该 proxy —— 插件拿到的 API 天然绑定本实例，任意并发互不覆盖。
  const nodeIO = node.config?.__nodeIO || {}
  const inputs = node.inputs || nodeIO.inputs || {}
  const config = node.config || {}
  const uid = randomUUID()

  globalThis.__freerpaInstances = globalThis.__freerpaInstances || {}
  globalThis.__freerpaInstances[uid] = {
    complete: (outputs) => context.complete(outputs),
    next: (outputs) => context.next(outputs),
    wait: (ms) => context.wait(ms),
    inputs,
    config
  }

  // 实例级 runtime：data URL，顶层同步读取注册表并闭包捕获（不同 uid ⇒ 独立模块实例）
  const instanceRuntimeUrl = buildInstanceRuntime(uid)

  // 兼容 default 导出函数：调用并按其返回值自动完成
  const runMod = async (mod) => {
    const executeFn = mod.default
    if (typeof executeFn !== 'function') return // 插件为顶层执行型，import resolve 即完成
    const result = await executeFn({ inputs, config })
    if (result && typeof result === 'object') {
      const currentOutputs = context.getOutputs()
      if (!currentOutputs || Object.keys(currentOutputs).length === 0) {
        context.complete(result)
      }
    }
  }

  // 读取插件源码，把裸导入 "freerpa"/'freerpa' 重写为实例级 runtime URL（兼容打包产物无空格的 from"freerpa"）
  let raw
  try {
    raw = fs.readFileSync(plugin.executePath, 'utf-8')
  } catch (err) {
    throw new Error(`无法读取插件源码: ${err.message}`)
  }

  // 若写入了临时 proxy 文件，用于 finally 清理
  let proxyPath = null
  try {
    if (!/(["'])freerpa\1/.test(raw)) {
      // 不依赖 freerpa API 的插件：直接以原始路径加载（普通模块）
      await import(pathToFileURL(plugin.executePath).href + '?v=' + Date.now() + '_' + uid)
      return
    }

    const rewritten = raw.replace(/["']freerpa["']/g, JSON.stringify(instanceRuntimeUrl))

    if (!/from\s*["']\.\//.test(raw)) {
      // 无相对导入的插件：直接用 data URL 执行 —— 零临时文件、零写权限依赖，
      // 每实例独立 data URL 天然绕过模块缓存，任意并发互不覆盖。
      try {
        await runMod(await import('data:text/javascript;base64,' + btoa(rewritten)))
      } catch {
        // 保底回退：直接加载原始模块（避免 data URL 解析差异等边缘情况导致回归）
        const mod = await import(pathToFileURL(plugin.executePath).href + '?v=' + Date.now() + '_' + uid)
        await runMod(mod)
      }
      return
    }

    // 带相对导入的插件：proxy 文件放插件同目录保证相对依赖（如 './util.js'）仍按原目录解析
    proxyPath = path.join(path.dirname(plugin.executePath), `.${path.basename(plugin.executePath)}.fr-${uid}.mjs`)
    fs.writeFileSync(proxyPath, rewritten)
    await runMod(await import(pathToFileURL(proxyPath).href))
  } finally {
    if (proxyPath) {
      try { fs.unlinkSync(proxyPath) } catch { /* 忽略清理失败 */ }
    }
    delete globalThis.__freerpaInstances[uid]
  }
}

export default execute
