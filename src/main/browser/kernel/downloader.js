/**
 * @file: 内核下载与检查
 * @author: FreeRPA
 *
 * 负责：内核文件下载、检查、解压
 */

import { app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fsp from 'fs/promises'
import path from 'path'
import fs from 'fs-extra'
import https from 'https'
import http from 'http'

const execFileAsync = promisify(execFile)

// 内核存储根目录
export const KERNEL_DIR = path.join(app.getPath('userData'), 'kernels')

/**
 * 获取平台标识
 */
export const getPlatform = () => {
  switch (process.platform) {
    case 'win32': return 'windows'
    case 'darwin': return 'macos'
    case 'linux': return 'linux'
    default: return process.platform
  }
}

/**
 * 获取内核二进制文件名
 */
export const getKernelBinaryName = (platform) => {
  if (platform === 'windows') return 'chrome.exe'
  if (platform === 'macos') return 'Chromium.app/Contents/MacOS/Chromium'
  return 'chrome'
}

/**
 * 获取内核存储路径
 */
export const getKernelPath = (platform, version) => {
  return path.join(KERNEL_DIR, platform, version)
}

/**
 * 获取内核二进制路径
 */
export const getKernelBinaryPath = (platform, version) => {
  const kernelPath = getKernelPath(platform, version)
  const binaryName = getKernelBinaryName(platform)
  return path.join(kernelPath, binaryName)
}

/**
 * 检查内核是否已下载
 */
export const checkKernelExists = (platform, version) => {
  const binaryPath = getKernelBinaryPath(platform, version)
  return fs.existsSync(binaryPath)
}

/**
 * 处理下载流
 */
const handleDownload = (response, downloadPath, onProgress, resolve, reject) => {
  const totalSize = parseInt(response.headers['content-length'] || '0', 10)
  let downloadedSize = 0
  const fileStream = fs.createWriteStream(downloadPath)

  response.on('data', (chunk) => {
    downloadedSize += chunk.length
    if (totalSize > 0) {
      const percent = downloadedSize / totalSize
      onProgress(Math.min(percent, 0.9), `下载中 ${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB`)
    }
  })

  fileStream.on('finish', () => {
    fileStream.close()
    // 完整性校验：服务端带 Content-Length 时，实际大小必须一致，防止下载中断产生损坏压缩包
    if (totalSize > 0 && downloadedSize !== totalSize) {
      fs.unlink(downloadPath, () => {})
      reject(new Error(`下载不完整：预期 ${totalSize} 字节，实际收到 ${downloadedSize} 字节`))
      return
    }
    resolve()
  })

  fileStream.on('error', (err) => {
    fs.unlink(downloadPath, () => {})
    reject(new Error('文件写入失败: ' + (err.message || err)))
  })

  response.pipe(fileStream)
}

/**
 * macOS：移除指定目录的隔离属性
 * 未签名内核被 Gatekeeper 拦截（无法打开「无法验证开发者」）时使用：下载解压后与启动前各执行一次
 */
export const stripKernelQuarantine = async (targetDir) => {
  if (process.platform !== 'darwin') return
  try {
    await execFileAsync('xattr', ['-dr', 'com.apple.quarantine', targetDir])
  } catch (e) {
    // xattr 不存在该属性时非致命，忽略即可
    console.error('移除内核隔离属性失败:', e?.message || e)
  }
}

/**
 * 解压归档文件（按完整文件名识别，兼容双扩展名 .tar.gz / .tar.xz / .tgz）
 */
const extractArchive = async (archivePath, extractDir, platform) => {
  // path.extname 只取最后一个扩展名（如 xx.tar.gz → '.gz'），需用完整文件名识别
  const basename = path.basename(archivePath).toLowerCase()

  // .zip
  if (basename.endsWith('.zip')) {
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(archivePath)
    zip.extractAllTo(extractDir, true)
    return
  }

  // tar 系：.tar.gz / .tgz / .tar.xz / .tar（tar 的 -z/-J 可直解，无需先单独解缩，避免中间产物损坏）
  if (/\.(tar\.gz|tgz|tar\.xz|tar)$/.test(basename)) {
    const compressFlag = basename.endsWith('.tar.xz') ? '-xJf' : basename.endsWith('.tar') ? '-xf' : '-xzf'
    await execFileAsync('tar', [compressFlag, archivePath, '-C', extractDir])
    return
  }

  // windows 兜底：仍支持 zip
  if (platform === 'windows') {
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(archivePath)
    zip.extractAllTo(extractDir, true)
    return
  }

  // macOS 镜像 .dmg
  if (basename.endsWith('.dmg')) {
    const mountPoint = `/Volumes/chrome_${Date.now()}`
    await execFileAsync('hdiutil', ['attach', archivePath, '-mountpoint', mountPoint, '-nobrowse'])
    // 复制 .app（execFile 不经 shell，需自行枚举避免通配符依赖）
    const entries = await fsp.readdir(mountPoint)
    for (const name of entries.filter((n) => n.endsWith('.app'))) {
      await execFileAsync('cp', ['-R', path.join(mountPoint, name), extractDir])
    }
    await execFileAsync('hdiutil', ['detach', mountPoint])
    return
  }

  const ext = path.extname(archivePath)
  throw new Error(`不支持的文件格式: ${ext}`)
}

/**
 * 下载并解压内核
 * @param {object} kernel - { platform, version, download_url }
 * @param {function} onProgress - (percent, message) => {}
 */
export const downloadKernel = async (kernel, onProgress = () => {}) => {
  try {
    const { platform, version, download_url } = kernel
    if (!download_url) {
      throw new Error('内核下载链接为空')
    }

    const targetDir = getKernelPath(platform, version)
    const tempDir = targetDir + '.tmp'

    if (fs.existsSync(tempDir)) {
      await fs.remove(tempDir)
    }

    await fs.ensureDir(tempDir)

    // 确保 download_url 是绝对 URL
    let absoluteUrl = download_url
    try { new URL(download_url) } catch {
      // 相对路径，拼接 API 基础地址
      const { API_CONFIG } = await import('@/api/config')
      absoluteUrl = API_CONFIG.BASE_URL.replace(/\/+$/, '') + '/' + download_url.replace(/^\/+/, '')
    }

    const fileName = (() => {
      try { return path.basename(new URL(absoluteUrl).pathname) } catch { return 'kernel-download' }
    })()
    const downloadPath = path.join(tempDir, fileName)

    onProgress(0, '准备下载...')

    await new Promise((resolve, reject) => {
      const protocol = absoluteUrl.startsWith('https') ? https : http
      const req = protocol.get(absoluteUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location
          const redirectProtocol = redirectUrl.startsWith('https') ? https : http
          redirectProtocol.get(redirectUrl, (redirectResponse) => {
            if (redirectResponse.statusCode >= 400) {
              reject(new Error(`下载失败，服务器返回 ${redirectResponse.statusCode}`))
              return
            }
            handleDownload(redirectResponse, downloadPath, onProgress, resolve, reject)
          }).on('error', (err) => reject(new Error(`下载连接失败: ${err.message || err}`)))
          return
        }
        if (response.statusCode >= 400) {
          reject(new Error(`下载失败，服务器返回 ${response.statusCode}`))
          return
        }
        handleDownload(response, downloadPath, onProgress, resolve, reject)
      })
      req.on('error', (err) => reject(new Error(`下载连接失败: ${err.message || err}`)))
      req.setTimeout(30000, () => {
        req.destroy()
        reject(new Error('下载超时'))
      })
    })

    onProgress(0.9, '解压中...')

    const extractPath = targetDir
    await extractArchive(downloadPath, extractPath, platform)

    await fs.remove(tempDir)

    // 校验解压结果：必须能找到内核可执行文件，否则视为解压失败并清理损坏数据
    const binaryPath = getKernelBinaryPath(platform, version)
    if (!fs.existsSync(binaryPath)) {
      await fs.remove(targetDir)
      throw new Error('解压失败：未找到内核可执行文件，压缩包可能已损坏')
    }

    if (platform !== 'windows') {
      fs.chmodSync(binaryPath, 0o755)
    }

    // macOS：移除内核隔离属性，避免 Gatekeeper 拦截未签名内核
    if (platform === 'macos') {
      await stripKernelQuarantine(targetDir)
    }

    onProgress(1, '下载完成')

    return targetDir
  } catch (err) {
    throw new Error(typeof err?.message === 'string' ? err.message : String(err))
  }
}
