/**
 * @file: 确保 sqlite3 原生二进制存在（打包前调用）
 * sqlite3 是 N-API 模块，二进制由 prebuild-install 下载（或 node-gyp 本地编译）。
 * 网络失败时二进制缺失 → electron-builder 打包产物缺 node_sqlite3.node → 运行时
 * "Could not locate the bindings file"。本脚本幂等：已有二进制则跳过。
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 查找真实安装路径（yarn .deno 隔离布局下 node_modules/sqlite3 是符号链接）
const resolvePkgDir = (name) => {
  const link = path.join(root, 'node_modules', name)
  try {
    return fs.realpathSync(link)
  } catch {
    return link
  }
}

const sqliteDir = resolvePkgDir('sqlite3')
const bindings = [
  path.join(sqliteDir, 'build/Release/node_sqlite3.node'),
  path.join(sqliteDir, 'build/Debug/node_sqlite3.node')
]
const hasBinding = bindings.some((p) => fs.existsSync(p))

if (hasBinding) {
  console.log('✓ sqlite3 原生二进制已存在，跳过')
  process.exit(0)
}

console.log('sqlite3 原生二进制缺失，尝试 prebuild-install 下载…')
const run = (cmd, args) => {
  execFileSync(cmd, args, { cwd: sqliteDir, stdio: 'inherit' })
}
try {
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prebuild-install', '-r', 'napi'])
  console.log('✓ prebuild-install 下载成功')
} catch {
  console.warn('prebuild-install 失败，回退 node-gyp 本地编译（需编译工具链）…')
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['node-gyp', 'rebuild'])
}

if (!bindings.some((p) => fs.existsSync(p))) {
  console.error('✗ sqlite3 原生二进制仍不可用，请检查网络或编译工具链')
  process.exit(1)
}
