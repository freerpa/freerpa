/**
 * @file: 随包内置浏览器内核路径解析
 * @author: FreeRPA
 *
 * 负责：定位随包内置内核（浏览器不再依赖外部下载，内核随客户端一起分发）、地址属性处理
 */

import { app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs-extra'

const execFileAsync = promisify(execFile)

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
 * 获取内置内核的可执行文件相对路径（平台相关）
 */
export const getKernelBinaryRelative = (platform) => {
  if (platform === 'windows') return 'Chromium/chrome.exe'
  if (platform === 'macos') return 'Chromium.app/Contents/MacOS/Chromium'
  return 'chrome'
}

/**
 * 浏览器内核目录平台名（只分平台，不分架构）：win / darwin / linux
 */
const getKernelPlatformDir = () => {
  return process.platform === 'win32' ? 'win32' : process.platform
}

/**
 * 获取随包内置内核目录（当前平台）
 * 打包后位于 resources/browser/{platform}，开发环境位于项目根 browser/{platform}
 */
export const getBundledKernelDir = () => {
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'browser')
    : path.join(app.getAppPath(), 'browser')
  return path.join(root, getKernelPlatformDir())
}

/**
 * 获取随包内置内核二进制路径（不存在返回 null）
 */
export const getBundledKernelBinaryPath = () => {
  const binaryRelative = getKernelBinaryRelative(getPlatform())
  const dir = getBundledKernelDir()
  if (!fs.existsSync(dir)) return null
  return path.join(dir, binaryRelative)
}

/**
 * macOS：移除指定目录的隔离属性
 * 未签名内核被 Gatekeeper 拦截（无法打开「无法验证开发者」）时使用：启动前执行一次
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
