/**
 * @file: 内核下载与检查
 * @author: FreeRPA
 *
 * 负责：内核文件下载、检查、解压
 */

import { app } from 'electron'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import https from 'https'
import http from 'http'

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
    resolve()
  })

  fileStream.on('error', (err) => {
    fs.unlink(downloadPath, () => {})
    reject(new Error('文件写入失败: ' + (err.message || err)))
  })

  response.pipe(fileStream)
}

/**
 * 解压归档文件
 */
const extractArchive = async (archivePath, extractDir, platform) => {
  const ext = path.extname(archivePath).toLowerCase()

  if (ext === '.zip' || platform === 'windows') {
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(archivePath)
    zip.extractAllTo(extractDir, true)
  } else if (ext === '.tar.xz' || ext === '.tar.gz' || ext === '.tgz' || ext === '.tar') {
    const tarPath = archivePath.replace(/\.xz$|\.gz$/, '')
    if (ext === '.xz') {
      execSync(`xz -d "${archivePath}"`, { stdio: 'pipe' })
    } else if (ext === '.gz') {
      execSync(`gunzip -f "${archivePath}"`, { stdio: 'pipe' })
    }
    execSync(`tar -xf "${tarPath}" -C "${extractDir}"`, { stdio: 'pipe' })
  } else if (ext === '.dmg') {
    const mountPoint = `/Volumes/chrome_${Date.now()}`
    execSync(`hdiutil attach "${archivePath}" -mountpoint "${mountPoint}" -nobrowse`, { stdio: 'pipe' })
    execSync(`cp -R "${mountPoint}"/*.app "${extractDir}"`, { stdio: 'pipe' })
    execSync(`hdiutil detach "${mountPoint}"`, { stdio: 'pipe' })
  } else {
    throw new Error(`不支持的文件格式: ${ext}`)
  }

  if (fs.existsSync(archivePath)) {
    await fs.remove(archivePath)
  }
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

    const fileName = path.basename(new URL(download_url).pathname)
    const downloadPath = path.join(tempDir, fileName)

    onProgress(0, '准备下载...')

    await new Promise((resolve, reject) => {
      const protocol = download_url.startsWith('https') ? https : http
      const req = protocol.get(download_url, (response) => {
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

    if (platform !== 'windows') {
      const binaryPath = getKernelBinaryPath(platform, version)
      if (fs.existsSync(binaryPath)) {
        fs.chmodSync(binaryPath, 0o755)
      }
    }

    onProgress(1, '下载完成')

    return targetDir
  } catch (err) {
    throw new Error(typeof err?.message === 'string' ? err.message : String(err))
  }
}
