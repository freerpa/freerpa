/**
 * @file: 浏览器内核统一启动 — 收敛 env:openBrowser 与 worker RPC doLaunch 的重复实现
 * 浏览器内核随包分发，不再需要版本解析与下载。
 */
import { app } from 'electron'
import path from 'path'
import { API_CONFIG } from '@/api/config'
import { queryGeoInfo } from './utils/proxy.js'
import { getPlatform, launchKernel } from './kernel'
import { registerBrowser } from './manager'

/**
 * 内核启动 + 注册的统一流程
 * @param {Object} opts
 * @param {string} [opts.envId] 环境 ID（用于 sessions userDataDir 与注册）
 * @param {string} [opts.proxy] 代理地址
 * @param {number} [opts.fingerprintSeed] 指纹种子（默认随机）
 * @param {boolean} [opts.headless] 无头模式
 * @param {string} [opts.timezone] 时区（代理 GEO 检测结果优先）
 * @param {string} [opts.lang] 语言（代理 GEO 检测结果优先）
 * @param {string[]} [opts.extraArgs] 附加启动参数
 * @param {Electron.WebContents} [opts.sender] 注册时的 sender（用于复用实例更新）
 * @returns 内核实例 { process, port, wsEndpoint, id, userDataDir }
 */
export const launchEnvBrowser = async ({
  envId,
  proxy = '',
  fingerprintSeed,
  headless = false,
  timezone = '',
  lang = 'en-US',
  extraArgs = [],
  sender = null
}) => {
  // 代理 GEO 检测（校验代理可用性并获取时区/语言）
  let geoInfo = null
  if (proxy) {
    geoInfo = await queryGeoInfo(proxy, API_CONFIG.BASE_URL)
    if (!geoInfo) throw new Error('代理检测失败')
  }

  const userDataDir = envId ? path.join(app.getPath('userData'), 'sessions', String(envId)) : undefined
  const instance = await launchKernel({
    platform: getPlatform(),
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