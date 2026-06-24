//节点名称查重
export const getNodeName = (nodes, name) => {
  if(['开始流程','结束流程'].includes(name)){
    return name
  }
  let number = 0
  if (nodes.some((el) => el.data.name === name)) {
    if (name.includes('_')) {
      const names = name.split('_')
      name = names[0]
      number = parseInt(names[1])
      if (isNaN(number)) {
        number = 0
      }
      ++number
    } else {
      number = 1
    }
    return getNodeName(nodes, `${name}_${number}`)
  }
  return name
}
