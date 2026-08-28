/**
 * @file: 版本比较公共实现（主进程与渲染端共用，消除双份漂移）
 * semver 数字序列比较（1 / 1.2 / 1.2.3）：a>b → 1，a<b → -1，相等 → 0
 */
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
