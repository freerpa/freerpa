/**
 * @file: 插件打包（.frp）
 *  - esbuild 编译 {main 入口} 为单文件 bundle（依赖最小化）
 *  - 用 adm-zip 将 { package.json, 编译产物 } 打包为 .frp 单个文件（zip 格式）
 *  - .frp 内结构：package.json（main 指向编译产物）+ 编译产物（默认 src/index.js）
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import AdmZip from 'adm-zip'
import { app } from 'electron'
import clientPkg from '../../../package.json'
import { createRequire } from 'node:module'
import { readPluginPackage } from './manifest.js'

/**
 * 打包后（asar 内）环境下，esbuild 内部经 require.resolve 解析的平台二进制路径
 * 仍是 .asar 内的虚拟路径，child_process.spawn 无法执行（报 spawn ENOTDIR）。
 * 这里把 ESBUILD_BINARY_PATH 指向 app.asar.unpacked 中已实体化（asarUnpack）的平台二进制。
 *
 * 注意：esbuild 在模块加载时（`var ESBUILD_BINARY_PATH = process.env...`）就捕获了该环境变量，
 * 因此必须在 import('esbuild') 之前设置；本文件对 esbuild 采用 packFrp 内懒加载，
 * 避免它在应用启动时（顶部静态 require）就固化空值。
 */
const ensureEsbuildBinaryPath = () => {
  if (!app.isPackaged) return
  const binName = process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild'
  const platformPkg =
    process.platform === 'win32'
      ? `@esbuild/win32-${process.arch === 'arm64' ? 'arm64' : 'x64'}`
      : `@esbuild/${process.platform}-${process.arch}`
  const asarUnpacked = app.getAppPath().replace(/\.asar$/, '.asar.unpacked')
  const binPath = path.join(asarUnpacked, 'node_modules', platformPkg, binName)
  if (fs.existsSync(binPath)) {
    process.env.ESBUILD_BINARY_PATH = binPath
  }
}

/**
 * esbuild 插件：解析 deno 风格 npm: 前缀依赖（如 `npm:js-md5` / `npm:js-md5@0.9.2`）。
 * 去掉前缀与可选版本号后，从插件目录的 node_modules 解析真实包（否则 esbuild 会把 "npm:js-md5" 当作裸说明符查找失败）。
 */
const npmPrefixPlugin = (srcDir) => ({
  name: 'npm-prefix',
  setup(build) {
    build.onResolve({ filter: /^npm:/ }, (args) => {
      const spec = args.path.slice(4).replace(/@\d+(\.\d+)*$/, '')
      const require = createRequire(path.join(srcDir, 'package.json'))
      try {
        return { path: require.resolve(spec) }
      } catch {
        return { errors: [{ text: `无法解析依赖: ${args.path}（请在插件目录安装该依赖后重试）` }] }
      }
    })
  }
})

/**
 * 打包插件目录为 .frp 文件。
 * @param {string} srcDir 插件源码目录（开发版目录或已安装目录，含 package.json）
 * @param {string} outPath .frp 输出路径
 * @param {(percent:number,label:string)=>void} [onProgress] 进度回调
 * @returns {Promise<{file:string, pluginId:string, version:string}>}
 */
export async function packFrp(srcDir, outPath, onProgress = () => {}) {
  onProgress(5, '读取插件元数据')
  const pkg = readPluginPackage(srcDir)
  if (!pkg || pkg.error) throw new Error(pkg?.error || '目录下缺少可用的 package.json')
  if (!/^\d+(\.\d+)*$/.test(pkg.version)) {
    throw new Error(`插件版本号不合法: ${pkg.version}`)
  }
  if (!pkg.hasExecute) {
    throw new Error(`执行器主文件不存在: ${pkg.main}`)
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frp-pack-'))
  try {
    // 1. esbuild 编译（bundle 依赖，最小化体积）
    onProgress(20, '编译插件（依赖最小化）')
    // 打包后环境：先把 esbuild 平台二进制指向 app.asar.unpacked 实体文件，再懒加载 esbuild，
    // 确保其模块加载时能捕获到 ESBUILD_BINARY_PATH（规避 spawn ENOTDIR）
    ensureEsbuildBinaryPath()
    const { build } = await import('esbuild')
    const entry = pkg.executePath
    const outFile = path.join(tmpDir, pkg.main)
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'neutral', // 面向 deno worker 运行时
      mainFields: ['module', 'main'], // neutral 平台需显式声明，否则忽略 CJS 依赖的 main 字段
      target: 'esnext',
      outfile: outFile,
      plugins: [npmPrefixPlugin(srcDir)],
      logLevel: 'error',
      minify: true
    })

    // 2. 组装 .frp（package.json + 编译产物）
    onProgress(70, '组装 .frp 文件')
    const zip = new AdmZip()
    // 最低客户端版本：freerpa 直接为字符串，打包时自动填充为「打包方当时的客户端版本」，取代手工维护。
    // 只写入 .frp，不改动插件源码目录的 package.json。
    const distPkg = {
      ...pkg.packageJson,
      freerpa: clientPkg.version
    }
    zip.addFile('package.json', Buffer.from(JSON.stringify(distPkg, null, 2), 'utf-8'))
    // 编译产物相对 srcDir 的路径（如 src/index.js）
    const relOut = pkg.main.split(/[\\/]/).filter(Boolean).join('/')
    if (relOut && relOut !== 'package.json') {
      zip.addLocalFile(outFile, relOut.split('/').slice(0, -1).join('/'), relOut.split('/').pop())
    }
    zip.writeZip(outPath)
    onProgress(100, '打包完成')
    return { file: outPath, pluginId: pkg.pluginId, version: pkg.version }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
