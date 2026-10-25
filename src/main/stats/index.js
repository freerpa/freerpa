/**
 * @file: 客户端日活/使用统计上报
 * 启动时上报 /api/stats/startup，运行中每 60s 上报一次使用时长 /api/stats/usage
 * deviceId 持久化在 settings 表（首次生成后固定），静默失败不影响主流程
 */
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { API_CONFIG } from '@/api/config'
import { queryGeoInfo } from '../browser/utils/proxy.js'
import { getSetting, upsertSetting } from '../data/settings'
import { getPlatformKey } from '../../shared/platform.js'

let db = null
let deviceId = ''
let startedAt = 0
let timer = null

const STATS_KEY = 'device_id'

// 统计上报固定走线上站点：dev 环境 API_CONFIG 指向 localhost（本地通常未启动官网服务），
// 会让开发期/本地运行的客户端完全不上报，后台日活长期为 0。
// 如需覆盖，可在 .env 配置 VITE_STATS_URL。
const STATS_BASE_URL =
  import.meta.env.VITE_STATS_URL || import.meta.env.VITE_PROD_URL || API_CONFIG.BASE_URL

/** 获取稳定的设备 ID（settings 持久化） */
async function getDeviceId() {
  if (deviceId) return deviceId
  const existing = await getSetting(db, STATS_KEY)
  if (existing && typeof existing === 'string') {
    deviceId = existing
  } else {
    deviceId = randomUUID()
    await upsertSetting(db, STATS_KEY, deviceId)
  }
  return deviceId
}

/** 上报接口（失败不影响使用，但保留状态码日志便于排查统计缺失） */
async function postStats(path, payload) {
  try {
    const res = await fetch(`${STATS_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(`[stats] 上报失败 ${path} ${res.status}: ${text.slice(0, 200)}`)
    }
  } catch (e) {
    // 网络不可用/接口异常时不影响客户端使用，仅记录原因
    console.warn(`[stats] 上报异常 ${path}: ${e?.message || e}`)
  }
}

/** 本地解析本机出口 IP 归属地（网站端不再查询，随上报携带）；失败返回 null，最长等待 10s */
async function resolveLocalGeo() {
  try {
    const info = await Promise.race([
      queryGeoInfo(''),
      new Promise((resolve) => setTimeout(() => resolve(null), 10_000)),
    ])
    if (!info) return null
    return {
      country_code: info.countryCode || '',
      country_name: info.country || '',
      region_name: info.region || '',
      city_name: info.city || '',
    }
  } catch {
    return null
  }
}

/** 启动上报（日活） */
async function reportStartup() {
  try {
    const id = await getDeviceId()
    const geo = await resolveLocalGeo()
    await postStats('/stats/startup', {
      device_id: id,
      // 会话启动时间（客户端时钟）：服务端以它作为会话起点，使后续 usage 能精确定位同一行会话
      start_time: new Date(startedAt).toISOString(),
      platform: getPlatformKey(),
      app_version: app.getVersion(),
      geo,
    })
  } catch {
    // 忽略
  }
}

/** 使用时长上报（会话开始后定时） */
async function reportUsage() {
  try {
    // 必须确保 device_id 已就绪：启动上报失败时模块变量可能仍为空，会让服务端以 400 丢弃
    const id = await getDeviceId()
    const duration = Math.round((Date.now() - startedAt) / 1000)
    await postStats('/stats/usage', {
      device_id: id,
      // 携带本次会话启动时间：服务端据此更新同一行会话，避免每分钟新增一条记录
      start_time: new Date(startedAt).toISOString(),
      platform: getPlatformKey(),
      app_version: app.getVersion(),
      duration_seconds: duration,
      end_time: new Date().toISOString(),
    })
  } catch {
    // 忽略
  }
}

/**
 * 初始化统计上报：必须在数据库初始化后调用
 * @param {object} database sqlite db 实例
 */
export const initStats = async (database) => {
  db = database
  startedAt = Date.now()
  await reportStartup()

  // 每 60s 上报一次使用时长（会话持续更新）
  timer = setInterval(() => {
    reportUsage()
  }, 60_000)
}

/** 退出时停止定时器（可选调用） */
export const stopStats = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
