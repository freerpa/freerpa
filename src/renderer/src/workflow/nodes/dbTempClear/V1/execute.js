/**
 * @file: 清空数据暂存节点执行器
 */

const execute = async (node, context) => {
  const { inputs } = node
  const { complete } = context

  
  if (typeof inputs.tempStore !== 'function') {
    throw new Error('请先连接数据暂存节点（dbTemp）')
  }
  inputs.tempStore()
  complete()

}

export default execute
