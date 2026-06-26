import { API_CONFIG } from '@/api/config'

/**
 * 获取IP信息
 */
export const getIpInfo = async (ip = '', method = 'IP138') => {
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/ip?ip=${ip}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const data = await res.json()
    return data
  } catch (error) {
    throw error
  }
}
