/**
 * @file: 确保 electron 二进制存在（postinstall 调用）
 * electron@43+ 移除了 postinstall，二进制改为惰性下载（require('electron') 时触发）。
 * electron-vite 启动时只检查 node_modules/electron/path.txt，缺失即报 "Electron uninstall"。
 * 本脚本在 yarn install 后主动触发下载（走 .npmrc electron_mirror 镜像），幂等。
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const resolvePkgDir = (name) => {
  const link = path.join(root, 'node_modules', name)
  try {
    return fs.realpathSync(link)
  } catch {
    return link
  }
}

const electronDir = resolvePkgDir('electron')
const pathFile = path.join(electronDir, 'path.txt')

const isReady = () => {
  if (!fs.existsSync(pathFile)) return false
  const exe = fs.readFileSync(pathFile, 'utf-8').trim()
  return exe && fs.existsSync(path.join(electronDir, 'dist', exe))
}

if (isReady()) {
  console.log('✓ electron 二进制已就绪')
  process.exit(0)
}

console.log('electron 二进制缺失，正在下载（使用 .npmrc 配置的 electron_mirror 镜像）…')

// 将 .npmrc 的 electron_mirror 显式传给 @electron/get（脱离 npm 上下文时也生效）
const env = { ...process.env }
try {
  const npmrc = fs.readFileSync(path.join(root, '.npmrc'), 'utf-8')
  const mirror = npmrc.match(/^electron_mirror=(.+)$/m)?.[1]
  if (mirror && !env.ELECTRON_MIRROR) env.ELECTRON_MIRROR = mirror.trim()
} catch { /* 无 .npmrc 则忽略 */ }

execFileSync(process.execPath, [path.join(electronDir, 'install.js')], {
  stdio: 'inherit',
  env,
  timeout: 600000 // 10 分钟上限
})

if (!isReady()) {
  console.error('✗ electron 二进制下载失败，请检查网络后重试 yarn install')
  process.exit(1)
}
console.log('✓ electron 二进制就绪')
