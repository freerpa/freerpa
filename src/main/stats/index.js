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

/** 上报接口（静默失败） */
async function postStats(path, payload) {
  try {
    await fetch(`${API_CONFIG.BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // 网络不可用/接口异常时静默忽略，不影响客户端使用
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
  const duration = Math.round((Date.now() - startedAt) / 1000)
  try {
    await postStats('/stats/usage', {
      device_id: deviceId,
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
