/**
 * @file: 浏览器内核统一启动 — 收敛 env:openBrowser 与 worker RPC doLaunch 的重复实现
 */
import { app } from 'electron'
import path from 'path'
import { API_CONFIG } from '@/api/config'
import { queryGeoInfo } from './utils/proxy.js'
import { checkKernelExists, downloadKernel, getPlatform, launchKernel, resolveKernelVersion } from './kernel'
import { registerBrowser } from './manager'

/**
 * 内核准备 + 启动 + 注册的统一流程
 * @param {Object} opts
 * @param {string} [opts.envId] 环境 ID（用于 sessions userDataDir 与注册）
 * @param {Object} [opts.kernel] 完整内核 { platform, version }（与 majorVersion 二选一）
 * @param {string} [opts.majorVersion] 主版本号（走 resolveKernelVersion 解析）
 * @param {string} [opts.proxy] 代理地址
 * @param {number} [opts.fingerprintSeed] 指纹种子（默认随机）
 * @param {boolean} [opts.headless] 无头模式
 * @param {string} [opts.timezone] 时区（代理 GEO 检测结果优先）
 * @param {string} [opts.lang] 语言（代理 GEO 检测结果优先）
 * @param {string[]} [opts.extraArgs] 附加启动参数
 * @param {boolean} [opts.autoDownload] 内核缺失时自动下载（false 则抛 KERNEL_NEED_DOWNLOAD）
 * @param {Electron.WebContents} [opts.sender] 注册时的 sender（用于复用实例更新）
 * @returns 内核实例 { process, port, wsEndpoint, id, userDataDir }
 */
export const launchEnvBrowser = async ({
  envId,
  kernel,
  majorVersion,
  proxy = '',
  fingerprintSeed,
  headless = false,
  timezone = '',
  lang = 'en-US',
  extraArgs = [],
  autoDownload = false,
  sender = null
}) => {
  // 代理 GEO 检测（校验代理可用性并获取时区/语言）
  let geoInfo = null
  if (proxy) {
    geoInfo = await queryGeoInfo(proxy, API_CONFIG.BASE_URL)
    if (!geoInfo) throw new Error('代理检测失败')
  }

  // 解析内核版本（完整版本直接使用，主版本号需解析）
  let resolved = kernel
  if (!resolved) {
    if (!majorVersion) throw new Error('浏览器配置未设置内核版本')
    resolved = await resolveKernelVersion(API_CONFIG.BASE_URL, majorVersion, getPlatform())
    if (!resolved) throw new Error(`当前平台无可用 Chrome ${majorVersion} 内核`)
  }
  if (!resolved?.platform || !resolved?.version) throw new Error('内核参数不完整')

  // 内核缺失处理：自动下载或抛 KERNEL_NEED_DOWNLOAD
  if (!checkKernelExists(resolved.platform, resolved.version)) {
    if (!autoDownload) throw new Error('KERNEL_NEED_DOWNLOAD')
    await downloadKernel(resolved, () => {})
  }

  const userDataDir = envId ? path.join(app.getPath('userData'), 'sessions', String(envId)) : undefined
  const instance = await launchKernel({
    platform: resolved.platform,
    version: resolved.version,
    proxy,
    fingerprintSeed: fingerprintSeed ?? Math.floor(Math.random() * 2147483647) + 1,
    headless,
    timezone: geoInfo?.timeZone || timezone,
    lang: geoInfo?.language || lang,
    userDataDir,
    extraArgs: ['--no-restore-session-state', '--disable-session-crashed-bubble', ...extraArgs]
  })

  if (envId) registerBrowser(envId, instance, sender)
  return instance
}
