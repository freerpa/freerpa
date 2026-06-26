/**
 * @file: fingerprint-chromium 内核启动器
 * @author: FreeRPA
 * @date: 2025
 *
 * 负责：
 * 1. 从后端下载/检查内核二进制
 * 2. 启动 fingerprint-chromium 进程
 * 3. 通过 CDP 连接
 * 4. 关闭进程清理
 */

import { app } from 'electron'
import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import https from 'https'
import http from 'http'
import { v4 as uuidv4 } from 'uuid'

// 内核存储根目录
const KERNEL_DIR = path.join(app.getPath('userData'), 'kernels')

// CDP 端口范围
const CDP_PORT_START = 19222
let currentPort = CDP_PORT_START

/**
 * 获取下一个可用 CDP 端口
 */
const getNextPort = () => {
  const port = currentPort
  currentPort++
  return port
}

/**
 * 获取平台标识
 */
const getPlatform = () => {
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
const getKernelBinaryName = (platform) => {
  if (platform === 'windows') return 'chrome.exe'
  if (platform === 'macos') return 'Chromium.app/Contents/MacOS/Chromium'
  return 'chrome' // linux
}

/**
 * 获取内核存储路径
 */
const getKernelPath = (platform, version) => {
  return path.join(KERNEL_DIR, platform, version)
}

/**
 * 获取内核二进制路径
 */
const getKernelBinaryPath = (platform, version) => {
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
 * 下载并解压内核
 * @param {object} kernel - { platform, version, download_url }
 * @param {function} onProgress - (percent) => {}
 */
export const downloadKernel = async (kernel, onProgress = () => {}) => {
  try {
    const { platform, version, download_url } = kernel
    if (!download_url) {
      throw new Error('内核下载链接为空')
    }

    const targetDir = getKernelPath(platform, version)
    const tempDir = targetDir + '.tmp'

    // 清除残留的临时目录
    if (fs.existsSync(tempDir)) {
      await fs.remove(tempDir)
    }

    // 确保目标目录存在
    await fs.ensureDir(tempDir)

    const fileName = path.basename(new URL(download_url).pathname)
    const downloadPath = path.join(tempDir, fileName)

    onProgress(0, '准备下载...')

    // 下载文件
    await new Promise((resolve, reject) => {
      const protocol = download_url.startsWith('https') ? https : http
      const req = protocol.get(download_url, (response) => {
        // 处理重定向
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

    // 解压
    const extractPath = targetDir
    await extractArchive(downloadPath, extractPath, platform)

    // 清理临时文件
    await fs.remove(tempDir)

    // 确保二进制文件有执行权限
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
    // 使用系统 unzip 或内置解压库
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(archivePath)
    zip.extractAllTo(extractDir, true)
  } else if (ext === '.tar.xz' || ext === '.tar.gz' || ext === '.tgz' || ext === '.tar') {
    // 使用 tar 命令
    const tarPath = archivePath.replace(/\.xz$|\.gz$/, '')
    if (ext === '.xz') {
      execSync(`xz -d "${archivePath}"`, { stdio: 'pipe' })
    } else if (ext === '.gz') {
      execSync(`gunzip -f "${archivePath}"`, { stdio: 'pipe' })
    }
    execSync(`tar -xf "${tarPath}" -C "${extractDir}"`, { stdio: 'pipe' })
  } else if (ext === '.dmg') {
    // macOS dmg: mount and copy
    const mountPoint = `/Volumes/chrome_${Date.now()}`
    execSync(`hdiutil attach "${archivePath}" -mountpoint "${mountPoint}" -nobrowse`, { stdio: 'pipe' })
    execSync(`cp -R "${mountPoint}"/*.app "${extractDir}"`, { stdio: 'pipe' })
    execSync(`hdiutil detach "${mountPoint}"`, { stdio: 'pipe' })
  } else {
    throw new Error(`不支持的文件格式: ${ext}`)
  }

  // 删除归档文件
  if (fs.existsSync(archivePath)) {
    await fs.remove(archivePath)
  }
}

/**
 * 启动 fingerprint-chromium 内核
 * 不再维护内部实例 Map，由调用方自行跟踪
 */
export const launchKernel = async (options = {}) => {
  const {
    platform = getPlatform(),
    version,
    proxy = '',
    fingerprintSeed = Math.floor(Math.random() * 100000),
    offscreen = false,
    userDataDir = path.join(app.getPath('userData'), 'sessions', uuidv4()),
    lang = 'en-US',
    extraArgs = [],
    timezone = '',
  } = options

  if (!version) throw new Error('必须指定内核版本')

  const binaryPath = getKernelBinaryPath(platform, version)
  if (!fs.existsSync(binaryPath)) throw new Error(`内核不存在: ${platform}/${version}，请先下载`)

  const cdpPort = getNextPort()

  const args = [
    `--remote-debugging-port=${cdpPort}`,
    `--fingerprint=${fingerprintSeed}`,
    `--fingerprint-platform=${platform}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check',
    `--lang=${lang}`,
    ...extraArgs,
  ]

  if (offscreen) args.push('--headless=new')

  if (proxy) {
    args.push(`--proxy-server=${proxy.replace(/\/\/.+:.+@/, '//')}`, '--disable-non-proxied-udp')
  }

  if (timezone) args.push(`--timezone=${timezone}`)

  const childProcess = spawn(binaryPath, args, { stdio: 'ignore' })

  childProcess.on('error', (err) => console.error('启动内核失败:', err))
  childProcess.on('exit', (code) => console.log(`内核进程退出, code: ${code}`))

  const id = uuidv4()
  const wsEndpoint = await waitForCdpReady(cdpPort, 30000)

  return { process: childProcess, port: cdpPort, wsEndpoint, id, userDataDir }
}

/**
 * 等待CDP端口就绪
 */
const waitForCdpReady = (port, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      fetch(`http://127.0.0.1:${port}/json/version`)
        .then(r => r.json())
        .then(d => d.webSocketDebuggerUrl ? resolve(d.webSocketDebuggerUrl) : retry())
        .catch(() => retry())
    }
    const retry = () => {
      if (Date.now() - start > timeout) return reject(new Error('CDP端口连接超时'))
      setTimeout(check, 500)
    }
    check()
  })
}

/**
 * 从后端获取可用内核列表
 */
export const fetchKernelList = async (baseUrl) => {
  try {
    const response = await fetch(`${baseUrl}/kernel/list?platform=${getPlatform()}`)
    const data = await response.json()
    if (data.code === 200) {
      return data.data
    }
    return []
  } catch (e) {
    console.error('获取内核列表失败:', e)
    return []
  }
}
/**
 * 获取推荐内核版本（最新版本）
 */
export const getRecommendedKernel = async (baseUrl) => {
  const kernels = await fetchKernelList(baseUrl)
  if (kernels.length > 0) {
    return kernels[0] // 已按版本降序排列
  }
  return null
}
