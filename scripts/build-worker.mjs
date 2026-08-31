#!/usr/bin/env node
/**
 * @file: 构建 worker 运行时资源（deno 宿主 + 引擎 + 节点执行器 + 依赖闭包）
 * @usage: node scripts/build-worker.mjs [--dev]
 *
 * 产出 resources/worker/：
 *   - host.js / engine.js / bridge.js / worker-common.js / data-bridge.js /
 *     electron-bridge.js / import-map.json / core/**           （worker 源码）
 *   - nodes/<type>/V<n>/execute.js（含同目录相对依赖）        （节点执行器）
 *   - node_modules/**                                          （deno cache 预填充的依赖闭包）
 *   - version.json
 *
 * 开发模式（--dev）：仅复制源码，跳过 deno cache（dev 直接用项目根 node_modules）。
 */
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const root = path.resolve(import.meta.dirname, '..')
const SRC = path.join(root, 'src', 'main', 'workflow', 'worker')
const NODES_SRC = path.join(root, 'src', 'renderer', 'src', 'workflow', 'nodes')
const OUT = path.join(root, 'resources', 'worker')
const NODES_OUT = path.join(OUT, 'nodes')
const isDev = process.argv.includes('--dev')

// ═══════════ 复制 worker 源码 ═══════════
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue // 跳过误入源码目录的依赖污染
    const s = path.join(from, entry.name)
    const d = path.join(to, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

fs.rmSync(OUT, { recursive: true, force: true })
copyDir(SRC, OUT)
console.log('✓ worker 源码 → resources/worker/')

// ═══════════ 复制节点执行器（含同目录相对依赖，节点自包含） ═══════════
/**
 * 遍历节点目录，收集全部 {type, ver, execute}（布局约定：nodes/{type}/{ver}/execute.js）
 * 复制 / import-map 扫描 / deno cache 入口三处共用，避免遍历逻辑各自实现
 */
function collectNodeExecutors(dir) {
  const list = []
  for (const type of fs.readdirSync(dir)) {
    const typeDir = path.join(dir, type)
    if (!fs.statSync(typeDir).isDirectory()) continue
    for (const ver of fs.readdirSync(typeDir)) {
      const execute = path.join(typeDir, ver, 'execute.js')
      if (fs.existsSync(execute)) list.push({ type, ver, execute })
    }
  }
  return list
}

/** 扫描 execute.js 的同目录相对 import（如 './handlers.js'），用于把节点自包含的本地模块一并复制 */
function collectRelativeImports(file) {
  const src = fs.readFileSync(file, 'utf-8')
  const deps = []
  const re = /from\s+['"](\.[^'"]+)['"]/g
  let m
  while ((m = re.exec(src))) {
    if (m[1].startsWith('./')) deps.push(m[1])
  }
  return deps
}

/** 解析节点定义 index.js 的 view 标志（default 导出对象中的字面量 view: true/false） */
function parseNodeViewFlag(indexSrc) {
  const m = indexSrc.match(/\bview\s*:\s*(true|false)/)
  return m ? m[1] === 'true' : null
}

/**
 * 显式校验节点目录约定（替代静默跳过 / 运行时才暴露）：
 *  - 版本目录必须含 execute.js（缺失 → 构建失败）
 *  - view: true 必须存在 view.vue（缺失 → 构建失败，CustomNode 动态 import 会白屏）
 *  - view: false 却存在 view.vue → 警告（死文件）
 */
function assertNodeLayout(dir) {
  for (const type of fs.readdirSync(dir)) {
    const typeDir = path.join(dir, type)
    if (!fs.statSync(typeDir).isDirectory()) continue
    for (const ver of fs.readdirSync(typeDir)) {
      if (!/^V\d+$/.test(ver)) continue
      const vdir = path.join(typeDir, ver)
      const execute = path.join(vdir, 'execute.js')
      if (!fs.existsSync(execute)) {
        throw new Error(`节点缺失 execute.js: ${type}/${ver}/（布局约定 nodes/{type}/{ver}/execute.js）`)
      }
      const indexFile = path.join(vdir, 'index.js')
      if (!fs.existsSync(indexFile)) continue // 无渲染定义的执行器目录，跳过 view 校验
      const flag = parseNodeViewFlag(fs.readFileSync(indexFile, 'utf-8'))
      const viewFile = path.join(vdir, 'view.vue')
      if (!fs.existsSync(viewFile)) {
        if (flag === true) {
          throw new Error(`节点声明 view: true 但缺失 view.vue: ${type}/${ver}/（CustomNode 动态 import 会失败）`)
        }
      } else if (flag === false) {
        console.warn(`⚠ 节点声明 view: false 但存在 view.vue（死文件，建议删除）: ${type}/${ver}/`)
      }
    }
  }
}

assertNodeLayout(NODES_SRC)
let nodeCount = 0
for (const { type, ver, execute } of collectNodeExecutors(NODES_SRC)) {
  const destDir = path.join(NODES_OUT, type, ver)
  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(execute, path.join(destDir, 'execute.js'))
  // 复制 execute.js 的同目录相对依赖（如 ./handlers.js、./formatValue.js）——节点自包含的本地模块
  for (const dep of collectRelativeImports(execute)) {
    const depFile = path.join(path.dirname(execute), dep)
    if (fs.existsSync(depFile)) {
      fs.copyFileSync(depFile, path.join(destDir, dep))
    }
  }
  nodeCount++
}
// paramRefer 双端复用：复制渲染端唯一实现（worker core/paramRefer.js re-export 它）
fs.copyFileSync(path.join(NODES_SRC, '..', 'utils', 'paramRefer.js'), path.join(OUT, 'param-refer.js'))
console.log(`✓ 节点执行器 ${nodeCount} 个 → resources/worker/nodes/`)
console.log('✓ 参数引用工具 param-refer.js（渲染端唯一实现）→ resources/worker/')

// 生成生产 import map：paramRefer 指向复制后的文件 + 裸依赖映射为 npm:（离线闭包由 deno cache 填充）
fs.writeFileSync(path.join(OUT, 'import-map.json'), JSON.stringify(buildProdImportMap(), null, 2))
console.log('✓ 生产 import map 已生成')

// ═══════════ 版本信息 ═══════════
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
fs.writeFileSync(
  path.join(OUT, 'version.json'),
  JSON.stringify({ appVersion: pkg.version, builtAt: new Date().toISOString() }, null, 2)
)
// 最小 package.json：锚定 node_modules 创建位置（deno 在最近的 package.json 处建 node_modules）
fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify({ name: 'freerpa-worker', private: true }))

// ═══════════ 生成生产 import map ═══════════
function buildProdImportMap() {
  const base = JSON.parse(fs.readFileSync(path.join(SRC, 'import-map.json'), 'utf-8')).imports
  const prodMap = { ...base }
  prodMap['@renderer/workflow/utils/paramRefer.js'] = './param-refer.js'

  // 扫描 worker 全部源码 + 节点 execute.js 的裸说明符，映射为 npm:（版本取自项目 node_modules 实际安装版本）
  const files = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'nodes') walk(p)
      } else if (entry.name.endsWith('.js')) {
        files.push(p)
      }
    }
  }
  walk(OUT)
  for (const { execute } of collectNodeExecutors(NODES_OUT)) files.push(execute)
  const specs = new Set()
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf-8')
    for (const m of src.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
      const s = m[1]
      if (/^(\.|node:|npm:|\/|@\/|@pageEval|@dataModule|@renderer)/.test(s)) continue
      if (base[s]) continue // 已在 import map（别名/node 内置）
      specs.add(s)
    }
  }
  for (const s of specs) {
    const { pkg, subpath } = splitBareSpec(s)
    const ver = getPkgVersion(pkg)
    if (!ver) {
      console.warn(`⚠ 未找到依赖版本: ${pkg}（跳过映射 ${s}）`)
      continue
    }
    if (subpath) {
      // exact 映射完整 npm: 说明符（deno 不支持 npm: 前缀拼接）
      prodMap[s] = `npm:${pkg}@${ver}/${subpath}`
    } else {
      prodMap[pkg] = `npm:${pkg}@${ver}`
    }
  }
  return { imports: prodMap }
}

/** 拆分裸说明符为 { pkg, subpath }，正确处理 scoped 包（@scope/name[/sub]） */
function splitBareSpec(spec) {
  if (spec.startsWith('@')) {
    const parts = spec.split('/')
    if (parts.length < 2) return { pkg: spec, subpath: '' }
    return { pkg: `${parts[0]}/${parts[1]}`, subpath: parts.slice(2).join('/') }
  }
  const i = spec.indexOf('/')
  return i === -1 ? { pkg: spec, subpath: '' } : { pkg: spec.slice(0, i), subpath: spec.slice(i + 1) }
}

function getPkgVersion(pkg) {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', pkg, 'package.json'), 'utf-8'))
    return p.version
  } catch {
    return null
  }
}

// ═══════════ 预填充依赖闭包（deno cache --node-modules-dir） ═══════════
if (isDev) {
  console.log('dev 模式：跳过 deno cache（使用项目根 node_modules）')
  process.exit(0)
}

const denoBin = findDeno()
if (!denoBin) {
  console.warn('⚠ 未找到 deno，跳过依赖预填充（请先运行 node scripts/fetch-deno.mjs）')
  process.exit(0)
}

// 生成入口清单：host.js + 全部节点 execute.js
const entries = [path.join(OUT, 'host.js')]
for (const { execute } of collectNodeExecutors(NODES_OUT)) entries.push(execute)

const args = [
  'cache',
  '--node-modules-dir',
  '--min-dep-age=0',
  '--import-map',
  path.join(OUT, 'import-map.json'),
  ...entries
]
try {
  execFileSync(denoBin, args, { cwd: OUT, stdio: 'inherit' })
  materializeNodeModules(path.join(OUT, 'node_modules'))
  console.log(`✓ 依赖闭包已预填充 resources/worker/node_modules/（${entries.length} 个入口）`)
} catch (e) {
  console.error('deno cache 失败（构建机需联网）：', e.message)
  process.exit(1)
}

/**
 * 实体化 node_modules：deno 布局顶层为符号链接（pkg -> .deno/pkg@ver/...），
 * 打包工具复制时会跳过符号链接导致依赖缺失；解引用为真实目录（含内部链接）。
 *
 * 注意：deno 节点的传递依赖是「同级目录」存放（.deno/<pkg>@<ver>/node_modules/<dep>），
 * 仅解引用顶层符号链接会在实体化后丢失这些同级依赖（如 puppeteer-core → @puppeteer/browsers），
 * 导致运行时 "Could not find package ..." 。这里把 .deno 里所有传递依赖也展开到顶层 node_modules，
 * 使其可被 Node/deno 的逐级向上解析命中（近似 npm 扁平布局；缺失时优先取第一个版本）。
 */
function materializeNodeModules(dir) {
  if (!fs.existsSync(dir)) return
  // ① 顶层直接依赖符号链接 → 解引用为真实目录
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.deno') continue
    if (!entry.isSymbolicLink()) continue
    const link = path.join(dir, entry.name)
    const target = path.resolve(dir, fs.readlinkSync(link))
    if (!fs.existsSync(target)) continue
    fs.rmSync(link, { force: true })
    fs.cpSync(target, link, { recursive: true, dereference: true })
  }

  // ② 把 .deno 各缓存包里的传递依赖展开到顶层 node_modules
  const denoDir = path.join(dir, '.deno')
  if (fs.existsSync(denoDir)) {
    let surfaced = 0
    for (const host of fs.readdirSync(denoDir, { withFileTypes: true })) {
      if (!host.isDirectory()) continue
      const nm = path.join(denoDir, host.name, 'node_modules')
      if (!fs.existsSync(nm)) continue
      // consumerName / hostVersion：当前这个 .deno 宿主包对应的顶层包名与版本（去除最后 @版本 尾缀）。
      // 冲突时仅当顶层该包版本 === 本 host 版本（即它正是被 hoist 到顶层的那一份）才向它嵌套，
      // 避免把同名不同版本的传递依赖（如 https-proxy-agent@5 的 agent-base@6）误塞进 hoisted 的 @9 包下。
      const at = host.name.lastIndexOf('@')
      const consumerName = at > 0 ? host.name.slice(0, at) : host.name
      const hostVersion = at > 0 ? host.name.slice(at + 1) : ''
      surfacePackages(nm, dir, consumerName, hostVersion, (n) => { surfaced += n })
    }
    console.log(`✓ 展开 ${surfaced} 个传递依赖到 node_modules（冲突版本已按 consumer 嵌套安置）`)
  }

  console.log('✓ node_modules 顶层符号链接已实体化')
}

/**
 * 把某 .deno 宿主包 node_modules 下的包补齐到顶层 rootNm（近似 npm 扁平布局）。
 * - 顶层无此包名 → hoist 到顶层；
 * - 顶层已存在且是不同版本（冲突）→ 按 npm 语义嵌套到当前 consumer 的 node_modules 下，
 *   避免顶层旧版本遮蔽该 consumer 真正需要的正确版本（如 https-proxy-agent@9 需 agent-base@9 ESM，而非顶层 agent-base@6 CJS）。
 * - 当前包自身的目录（rel === consumerName）跳过，不自我嵌套。
 */
function surfacePackages(nm, rootNm, consumerName, hostVersion, onCount) {
  for (const seg of fs.readdirSync(nm, { withFileTypes: true })) {
    if (!seg.isDirectory() && !seg.isSymbolicLink()) continue
    let rel
    let src
    if (seg.name.startsWith('@')) {
      // scoped 包：@scope/name
      const scopeDir = path.join(nm, seg.name)
      for (const sub of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (!sub.isDirectory() && !sub.isSymbolicLink()) continue
        rel = `${seg.name}/${sub.name}`
        src = path.join(scopeDir, sub.name)
        if (maybeSurface(src, rootNm, rel, consumerName, hostVersion)) onCount(1)
      }
      continue
    }
    rel = seg.name
    src = path.join(nm, seg.name)
    if (maybeSurface(src, rootNm, rel, consumerName, hostVersion)) onCount(1)
  }
}

/**
 * 补齐单个 dep。返回是否新增。
 * 无冲突 → hoist 顶层；冲突 → 仅当顶层 consumer 确为本 host 版本时才嵌套到其目录下；自身目录 → 跳过。
 */
function maybeSurface(from, rootNm, rel, consumerName, hostVersion) {
  const dest = path.join(rootNm, rel)
  if (!fs.existsSync(dest)) {
    fs.cpSync(from, dest, { recursive: true, dereference: true })
    return true
  }
  // 顶层已占用（同名不同版本）：按 npm 语义嵌套安置——但仅当顶层 consumer 正是本 host 版本，
  // 否则（如 https-proxy-agent@5 也指向同名 hoisted @9）跳过，避免旧/新版本互相覆盖。
  if (!consumerName || !hostVersion || rel === consumerName) return false
  const consumerDir = path.join(rootNm, consumerName)
  const nestedDest = path.join(consumerDir, 'node_modules', rel)
  if (!fs.existsSync(consumerDir) || fs.existsSync(nestedDest)) return false
  let topVer = ''
  try { topVer = JSON.parse(fs.readFileSync(path.join(consumerDir, 'package.json'), 'utf-8')).version || '' } catch { return false }
  if (topVer !== hostVersion) return false
  fs.mkdirSync(path.dirname(nestedDest), { recursive: true })
  fs.cpSync(from, nestedDest, { recursive: true, dereference: true })
  return true
}

/** 查找 deno：resources/deno → PATH → 项目 node_modules/.bin */
function findDeno() {
  const platforms = fs.existsSync(path.join(root, 'resources', 'deno'))
    ? fs.readdirSync(path.join(root, 'resources', 'deno'))
    : []
  for (const p of platforms) {
    const bin = path.join(root, 'resources', 'deno', p, process.platform === 'win32' ? 'deno.exe' : 'deno')
    if (fs.existsSync(bin)) return bin
  }
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['deno'])
    return 'deno'
  } catch {
    return null
  }
}
