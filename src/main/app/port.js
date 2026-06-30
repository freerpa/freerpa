import { execSync } from 'child_process'

/**
 * 同步检查端口是否被占用
 */
export const isPortTakenSync = (port, host = '127.0.0.1') => {
  try {
    const platform = process.platform

    if (platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
      return output.includes('TCP') && output.includes(`:${port}`)
    }

    if (platform === 'darwin' || platform === 'linux') {
      const output = execSync(`lsof -Pi :${port} -sTCP:LISTEN -t`, { encoding: 'utf8', stdio: 'pipe' })
      return !!output.trim()
    }

    console.warn(`不支持的操作系统: ${platform}`)
    return false
  } catch {
    return false
  }
}

/**
 * 获取第一个可用端口（从 port 开始递增查找）
 */
export const getCanUsePort = (port) => {
  let canUsePort = port
  while (isPortTakenSync(canUsePort)) {
    canUsePort++
  }
  return canUsePort
}
