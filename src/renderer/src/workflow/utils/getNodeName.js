//节点名称查重
export const getNodeName = (nodes, name) => {
  if(['开始流程','结束流程'].includes(name)){
    return name
  }
  // 预建名字集合，避免递归内每次全量扫描 O(n)
  const nameSet = new Set(nodes.map((el) => el.data.name))

  const resolve = (candidate) => {
    if (!nameSet.has(candidate)) return candidate
    // 拆分前缀与序号；仅当尾段为纯数字时递增，否则保留原名直接追加 _1（避免 foo_bar → foo_1 丢失后缀）
    const idx = candidate.lastIndexOf('_')
    if (idx > 0) {
      const trailing = candidate.slice(idx + 1)
      if (/^\d+$/.test(trailing)) {
        return resolve(`${candidate.slice(0, idx)}_${parseInt(trailing, 10) + 1}`)
      }
    }
    return resolve(`${candidate}_1`)
  }
  return resolve(name)
}
