/**
 * @file: fingerprint-chromium 内核启动器
 * @author: FreeRPA
 *
 * 负责：启动 fingerprint-chromium 进程，CDP 连接
 */

import { app, dialog } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'
import { getKernelBinaryPath, getPlatform, stripKernelQuarantine } from './downloader'

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
 * 把内核启动失败转为可读错误；macOS 未授权/未签名时弹窗引导用户授权
 */
const createLaunchError = (err = {}, platform, kernelDir) => {
  const isMacAuth =
    platform === 'macos' &&
    (err?.code === 'EACCES' || err?.code === 'EPERM' || err?.signal === 'SIGKILL' || typeof err?.code === 'number')
  if (isMacAuth) {
    showMacAuthorizeDialog(kernelDir)
    return new Error('macOS 阻止了未签名浏览器内核的运行，请按弹窗引导授权后重试')
  }
  const base = err?.message || (err?.code ? `内核启动失败（${err.code}）` : '内核进程启动失败')
  return new Error(String(base))
}

/**
 * macOS 未签名内核被拦截时，弹窗给出授权引导
 */
const showMacAuthorizeDialog = (kernelDir) => {
  dialog.showMessageBox({
    type: 'warning',
    title: '浏览器内核无法启动',
    message: 'macOS 阻止了未签名浏览器内核的运行',
    detail: [
      '请在「系统设置 → 隐私与安全性 → 安全性」中为内核点击「仍要打开」以允许运行。',
      '若仍无法启动，请打开「终端」执行以下命令移除内核的隔离属性后再试：',
      `xattr -dr com.apple.quarantine "${kernelDir}"`,
    ].join('\n\n'),
    buttons: ['知道了'],
    defaultId: 0,
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

  // macOS：启动前再次移除隔离属性，避免 Gatekeeper 拦截未签名内核
  if (platform === 'macos') {
    try { await stripKernelQuarantine(path.dirname(binaryPath)) } catch (e) { console.error('移除内核隔离属性失败:', e?.message || e) }
  }

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
    childProcess.once('error', (err) => settle(createLaunchError(err || {}, platform, path.dirname(binaryPath))))
    childProcess.once('exit', (code) => {
      if (code !== 0) settle(createLaunchError({ code }, platform, path.dirname(binaryPath)))
    })
  })

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
 * 通过主版本号解析完整内核版本
 */
export const resolveKernelVersion = async (baseUrl, majorVersion, platform) => {
  try {
    const response = await fetch(`${baseUrl}/kernel/resolveVersion?major_version=${majorVersion}&platform=${platform}`)
    const data = await response.json()
    if (data.code === 200 && data.data) {
      return data.data  // { platform, version, download_url }
    }
    return null
  } catch (e) {
    console.error('解析内核版本失败:', e)
    return null
  }
}
