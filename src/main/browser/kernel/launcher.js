/**
 * @file: fingerprint-chromium 内核启动器
 * @author: FreeRPA
 *
 * 负责：启动 fingerprint-chromium 进程，CDP 连接
 */

import { app } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'
import { getKernelBinaryPath, getPlatform } from './downloader'

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
 * 等待 CDP 端口就绪
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
 * 启动 fingerprint-chromium 内核
 */
export const launchKernel = async (options = {}) => {
  const {
    platform = getPlatform(),
    version,
    proxy = '',
    fingerprintSeed = Math.floor(Math.random() * 100000),
    headless = false,
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

  if (headless) args.push('--headless=new')

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
    return kernels[0]
  }
  return null
}
