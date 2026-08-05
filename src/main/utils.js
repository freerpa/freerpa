/**
 * @file: 主进程公共工具
 */

/** 格式化字节为可读字符串 */
export const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[Math.min(i, units.length - 1)]
}
