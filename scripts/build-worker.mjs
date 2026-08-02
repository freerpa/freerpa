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
const isDev = process.argv.includes('--dev')

// ═══════════ 复制 worker 源码 ═══════════
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
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
const nodesOut = path.join(OUT, 'nodes')
const dataHandlersSrc = path.join(NODES_SRC, '..', 'dataHandlers')
let nodeCount = 0
for (const type of fs.readdirSync(NODES_SRC)) {
  const typeDir = path.join(NODES_SRC, type)
  if (!fs.statSync(typeDir).isDirectory() || type === 'dataHandlers') continue
  for (const ver of fs.readdirSync(typeDir)) {
    const exe = path.join(typeDir, ver, 'execute.js')
    if (!fs.existsSync(exe)) continue
    const dest = path.join(nodesOut, type, ver, 'execute.js')
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(exe, dest)
    nodeCount++
  }
}
// dataHandlers 相对 import（types/*）随目录复制
copyDir(dataHandlersSrc, path.join(OUT, 'data-handlers'))
console.log(`✓ 节点执行器 ${nodeCount} 个 + dataHandlers → resources/worker/nodes|data-handlers/`)

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
  for (const type of fs.readdirSync(nodesOut)) {
    const typeDir = path.join(nodesOut, type)
    if (!fs.statSync(typeDir).isDirectory()) continue
    for (const ver of fs.readdirSync(typeDir)) {
      const exe = path.join(typeDir, ver, 'execute.js')
      if (fs.existsSync(exe)) files.push(exe)
    }
  }
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
for (const type of fs.readdirSync(nodesOut)) {
  const typeDir = path.join(nodesOut, type)
  if (!fs.statSync(typeDir).isDirectory()) continue
  for (const ver of fs.readdirSync(typeDir)) {
    const exe = path.join(typeDir, ver, 'execute.js')
    if (fs.existsSync(exe)) entries.push(exe)
  }
}

const args = [
  'cache',
  '--node-modules-dir',
  '--import-map',
  path.join(OUT, 'import-map.json'),
  ...entries
]
try {
  execFileSync(denoBin, args, { cwd: OUT, stdio: 'inherit' })
  console.log(`✓ 依赖闭包已预填充 resources/worker/node_modules/（${entries.length} 个入口）`)
} catch (e) {
  console.error('deno cache 失败（构建机需联网）：', e.message)
  process.exit(1)
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
