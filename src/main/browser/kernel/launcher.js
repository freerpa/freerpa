/**
 * @file: fingerprint-chromium 内核启动器
 * @author: FreeRPA
 *
 * 负责：启动随包内置的 fingerprint-chromium 进程，CDP 连接
 */

import { app } from 'electron'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getBundledKernelBinaryPath, getPlatform, stripKernelQuarantine } from './paths'

const execAsync = promisify(exec)

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
 * 清理被强制退出后残留的、占用同一 profile（userDataDir）的内核进程。
 * 仅精确匹配该 userDataDir，不会误杀仍在运行的其他环境浏览器。
 */
const killOrphanByUserDataDir = async (userDataDir) => {
  if (!userDataDir) return
  try {
    if (process.platform === 'win32') {
      // 匹配命令行包含该 userDataDir 的进程并终止（WMI LIKE）
      const dir = userDataDir.replace(/'/g, "''")
      await execAsync(`wmic process where "CommandLine like '%${dir}%'" call terminate`)
    } else if (process.platform === 'darwin' || process.platform === 'linux') {
      // pkill -f 按完整命令行匹配；无匹配时退出码为 1，非致命
      const dir = userDataDir.replace(/'/g, "'\\''")
      await execAsync(`pkill -f '${dir}'`)
    }
  } catch {
    // 无残留进程或清理失败均视为正常
  }
}

/**
 * 把内核启动失败转为可读错误；不再弹窗，避免被误判为 macOS 未签名提示
 */
const createLaunchError = (err = {}) => {
  const base = err?.message || (err?.code ? `内核启动失败（${err.code}）` : '内核进程启动失败')
  return new Error(String(base))
}

/**
 * 启动随包内置的 fingerprint-chromium 内核
 */
export const launchKernel = async (options = {}) => {
  const {
    platform = getPlatform(),
    proxy = '',
    fingerprintSeed = Math.floor(Math.random() * 100000),
    headless = false,
    userDataDir = path.join(app.getPath('userData'), 'sessions', uuidv4()),
    lang = 'en-US',
    extraArgs = [],
    timezone = '',
  } = options

  // 内核随包分发，直接定位内置二进制
  const binaryPath = getBundledKernelBinaryPath()
  if (!binaryPath) {
    throw new Error(`未找到随包内置内核（${platform}），请确认客户端安装完整`)
  }

  // macOS：启动前移除隔离属性，避免 Gatekeeper 拦截未签名内核
  if (platform === 'macos') {
    try { await stripKernelQuarantine(path.dirname(binaryPath)) } catch (e) { console.error('移除内核隔离属性失败:', e?.message || e) }
  }

  // 清理强制退出后残留、占用同一 profile 的内核进程（避免旧进程占用 profile/CDP 端口导致启动失败）
  await killOrphanByUserDataDir(userDataDir)

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

  // 监听内核启动异常（macOS 未授权等），快速失败并给出可操作提示，避免干等 CDP 超时
  await new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => settle(null), 1500)
    function settle(err) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      err ? reject(err) : resolve()
    }
    childProcess.once('error', (err) => settle(createLaunchError(err || {})))
    childProcess.once('exit', (code) => {
      if (code !== 0) settle(createLaunchError({ code }))
    })
  })

  childProcess.on('error', (err) => console.error('启动内核失败:', err))
  childProcess.on('exit', (code) => console.log(`内核进程退出, code: ${code}`))

  const id = uuidv4()
  const wsEndpoint = await waitForCdpReady(cdpPort, 30000)

  return { process: childProcess, port: cdpPort, wsEndpoint, id, userDataDir, headless }
}