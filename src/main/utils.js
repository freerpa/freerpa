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

/** semver 数字序列比较（1 / 1.2 / 1.2.3）：a>b → 1，a<b → -1，相等 → 0 */
export const compareSemver = (a, b) => {
  const pa = String(a ?? '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b ?? '').split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va !== vb) return va > vb ? 1 : -1
  }
  return 0
}
