#!/usr/bin/env node
/**
 * @file: 下载 deno 运行时二进制（版本跟随客户端版本，升级需显式修改 DENO_VERSION）
 * @usage: node scripts/fetch-deno.mjs [--force]
 *
 * 下载到 resources/deno/<platform>-<arch>/deno(.exe)，已存在且校验通过则跳过。
 * 资产命名参考 https://github.com/denoland/deno/releases
 */
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'

// ═══════════ 版本与平台映射 ═══════════
const DENO_VERSION = process.env.DENO_VERSION || '2.9.5'

// 下载源（依次尝试）：DENO_MIRROR 环境变量可覆盖（如 https://registry.npmmirror.com/-/binary/deno）
const MIRRORS = (process.env.DENO_MIRROR
  ? [process.env.DENO_MIRROR]
  : [
      'https://dl.deno.land/release',
      'https://github.com/denoland/deno/releases/download',
      'https://ghfast.top/https://github.com/denoland/deno/releases/download'
    ]).map((m) => m.replace(/\/+$/, ''))

const TARGETS = {
  'darwin-arm64': { asset: 'deno-aarch64-apple-darwin', ext: 'zip' },
  'darwin-x64': { asset: 'deno-x86_64-apple-darwin', ext: 'zip' },
  'linux-x64': { asset: 'deno-x86_64-unknown-linux-gnu', ext: 'zip' },
  'linux-arm64': { asset: 'deno-aarch64-unknown-linux-gnu', ext: 'zip' },
  'win32-x64': { asset: 'deno-x86_64-pc-windows-msvc', ext: 'zip' }
}

const root = path.resolve(import.meta.dirname, '..')
const outRoot = path.join(root, 'resources', 'deno')

const platformKey = `${process.platform}-${process.arch}`
const target = TARGETS[platformKey]
if (!target) {
  console.error(`不支持的平台: ${platformKey}，支持: ${Object.keys(TARGETS).join(', ')}`)
  process.exit(1)
}

const outDir = path.join(outRoot, platformKey)
const binName = process.platform === 'win32' ? 'deno.exe' : 'deno'
const binPath = path.join(outDir, binName)

// 已存在且版本匹配 → 跳过
if (!process.argv.includes('--force') && fs.existsSync(binPath)) {
  const ok = await verifyVersion(binPath)
  if (ok) {
    console.log(`deno 已就绪: ${binPath} (v${DENO_VERSION})`)
    process.exit(0)
  }
  console.log('版本不匹配，重新下载...')
}

console.log(`下载 deno v${DENO_VERSION} (${platformKey}) ...`)
const zipPath = path.join(outRoot, `${target.asset}.zip`)
fs.mkdirSync(outDir, { recursive: true })

// 依次尝试镜像源下载 zip
const url = await downloadWithMirrors(zipPath)
console.log(`下载完成: ${url}`)

// sha256 校验
const sumUrl = `${url}.sha256sum`
try {
    const sumResp = await fetch(sumUrl, { signal: AbortSignal.timeout(10000) })
    if (sumResp.ok) {
      const text = (await sumResp.text()).trim()
      // 兼容两种格式：
      // 1) "<hash>  <filename>"  2) "Algorithm : SHA256\nHash      : <hash>\n..."
      const m = text.match(/Hash\s*:\s*([0-9a-fA-F]{64})/i)
      const expectSum = m ? m[1] : text.split(/\s+/)[0]
      const { createHash } = await import('crypto')
      const actual = createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex')
      if (actual.toLowerCase() !== expectSum.toLowerCase()) {
        throw new Error(`sha256 校验失败: 期望 ${expectSum}，实际 ${actual}`)
      }
      console.log('sha256 校验通过')
    }
  } catch (e) {
  if (e.message?.startsWith('sha256 校验失败')) {
    fs.unlinkSync(zipPath)
    throw e
  }
  console.log('跳过 sha256 校验（镜像无校验文件）')
}

// 解压
const zip = new AdmZip(zipPath)
zip.extractAllTo(outDir, true)
fs.unlinkSync(zipPath)
if (process.platform !== 'win32') {
  fs.chmodSync(binPath, 0o755)
}

await verifyVersion(binPath)
console.log(`deno 已下载: ${binPath} (v${DENO_VERSION})`)

/** 依次尝试镜像下载 zip，成功返回所用 URL */
async function downloadWithMirrors(zipPath) {
  let lastErr
  for (const base of MIRRORS) {
    const url = `${base}/v${DENO_VERSION}/${target.asset}.${target.ext}`
    try {
      const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120000) })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const buf = Buffer.from(await resp.arrayBuffer())
      fs.writeFileSync(zipPath, buf)
      return url
    } catch (e) {
      lastErr = e
      console.warn(`镜像不可用 ${base}: ${e.cause?.code || e.message}`)
    }
  }
  throw new Error(`所有下载源均失败: ${lastErr?.message}`)
}

/** 运行 deno --version 验证 */
async function verifyVersion(binPath) {
  const { execFile } = await import('child_process')
  return new Promise((resolve) => {
    execFile(binPath, ['--version'], { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(false)
      const m = stdout.match(/deno\s+([\d.]+)/)
      console.log(stdout.trim().split('\n')[0])
      resolve(m ? m[1] === DENO_VERSION : false)
    })
  })
}
