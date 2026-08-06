#!/usr/bin/env node
/**
 * @file: 构建 worker 运行时资源（deno 宿主 + 引擎 + 节点执行器 + 依赖闭包）
 * @usage: node scripts/build-worker.mjs [--dev]
 *
 * 产出 resources/worker/：
 *   - host.js / engine.js / bridge.js / worker-common.js / data-bridge.js /
 *     electron-bridge.js / import-map.json / core/**           （worker 源码）
 *   - nodes/<type>/V<n>/execute.js + data-handlers/**          （节点执行器）
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
const DATA_HANDLERS_SRC = path.join(NODES_SRC, '..', 'dataHandlers') // nodes 上一级 workflow/dataHandlers
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

// ═══════════ 复制节点执行器与 dataHandlers ═══════════
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
  const dest = path.join(NODES_OUT, type, ver, 'execute.js')
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(execute, dest)
  nodeCount++
}
// dataHandlers 相对 import（types/*）随目录复制
copyDir(DATA_HANDLERS_SRC, path.join(OUT, 'data-handlers'))
// paramRefer 双端复用：复制渲染端唯一实现（worker core/paramRefer.js re-export 它）
fs.copyFileSync(path.join(NODES_SRC, '..', 'utils', 'paramRefer.js'), path.join(OUT, 'param-refer.js'))
console.log(`✓ 节点执行器 ${nodeCount} 个 + dataHandlers → resources/worker/nodes|data-handlers/`)
console.log('✓ 参数引用工具 param-refer.js（渲染端唯一实现）→ resources/worker/')

// 生成生产 import map：dataHandlers 指向复制后的目录 + 裸依赖映射为 npm:（离线闭包由 deno cache 填充）
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
  prodMap['@renderer/workflow/dataHandlers/'] = './data-handlers/'
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
    const pkg = s.split('/')[0]
    const ver = getPkgVersion(pkg)
    if (!ver) {
      console.warn(`⚠ 未找到依赖版本: ${pkg}（跳过映射 ${s}）`)
      continue
    }
    if (s.includes('/')) {
      // exact 映射完整 npm: 说明符（deno 不支持 npm: 前缀拼接）
      prodMap[s] = `npm:${pkg}@${ver}/${s.slice(pkg.length + 1)}`
    } else {
      prodMap[pkg] = `npm:${pkg}@${ver}`
    }
  }
  return { imports: prodMap }
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
 * 打包工具复制时会跳过符号链接导致依赖缺失；解引用为真实目录（含内部链接）
 */
function materializeNodeModules(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isSymbolicLink()) continue
    const link = path.join(dir, entry.name)
    const target = path.resolve(dir, fs.readlinkSync(link))
    if (!fs.existsSync(target)) continue
    fs.rmSync(link, { force: true })
    fs.cpSync(target, link, { recursive: true, dereference: true })
  }
  console.log('✓ node_modules 顶层符号链接已实体化')
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
