/**
 * @file: 工作流 IO 数据类型匹配（连接校验/自动连线的公共判定）
 * 规则：source类型与target类型任一交集，或任一侧含 'any' 即可连线。
 */

// 归一为数组形态：字符串 → 单元素数组
const toTypeArray = (type) => (typeof type === 'string' ? [type] : (type || []))

/** 判断 sourceType / targetType 是否可连线（两端均为 string 或数组） */
export const isTypeConnectable = (sourceType, targetType) => {
  const src = toTypeArray(sourceType)
  const tgt = toTypeArray(targetType)
  return (
    src.some((t) => tgt.includes(t)) ||
    tgt.some((t) => src.includes(t)) ||
    tgt.includes('any') ||
    src.includes('any')
  )
}