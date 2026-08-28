/**
 * @file: 平台标识（主进程共用，消除 kernel/paths、stats、ipc 三处重复实现）
 * 平台字段约定：win32 → 'windows'、darwin → 'macos'、其余 → 'linux'
 */

/** 获取平台标识（与网站 fr_app_versions 平台字段一致） */
export const getPlatformKey = () => {
  if (process.platform === 'darwin') return 'macos'
  if (process.platform === 'win32') return 'windows'
  return 'linux'
}
