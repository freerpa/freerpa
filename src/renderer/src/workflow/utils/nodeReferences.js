/**
 * 节点引用生命周期维护 —— 保留可读名字记号（{{节点名.输出名}}）前提下，堵住「改名/删除后引用失效」：
 * - renameNodeReferences：节点改名后，全图扫描 config 中的引用并同步新名
 * - countNodeReferences：统计某节点被引用次数（删除前提示）
 * 说明：节点引用形式为 {{节点名.输出名}}。
 */

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 匹配引用 token 中的节点名段：{{ 旧名. （lookahead 不消费 '.' */
const buildRefRe = (name) =>
  new RegExp(`\\{\\{([^{}]*?)${escapeRegExp(name)}(?=\\.)`, 'g')

/** 递归替换对象内所有字符串中的节点名引用，返回替换次数 */
export const renameNodeReferences = (nodes, oldName, newName) => {
  if (!oldName || !newName || oldName === newName) return 0
  const re = buildRefRe(oldName)
  let count = 0
  const walk = (value) => {
    if (typeof value === 'string') {
      // String.replace 每次重置 lastIndex，安全
      const replaced = value.replace(re, `{{$1${newName}`)
      if (replaced !== value) {
        count++
        return replaced
      }
      return value
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const r = walk(item)
        if (r !== item) value[i] = r
      })
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach((k) => {
        const r = walk(value[k])
        if (r !== value[k]) value[k] = r
      })
    }
    return value
  }
  nodes.forEach((node) => walk(node.data?.config))
  return count
}

/** 统计 nodes 中某节点名被引用的次数（含全局前缀形式） */
export const countNodeReferences = (nodes, nodeName) => {
  if (!nodeName) return 0
  const re = buildRefRe(nodeName)
  let count = 0
  const walk = (value) => {
    if (typeof value === 'string') {
      count += (value.match(re) || []).length
    } else if (Array.isArray(value)) {
      value.forEach(walk)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(walk)
    }
  }
  nodes.forEach((node) => walk(node.data?.config))
  return count
}
