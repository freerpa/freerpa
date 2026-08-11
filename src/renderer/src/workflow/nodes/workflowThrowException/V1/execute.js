/**
 * @file: 抛出异常节点执行器
 */
const execute = async (node, context) => {
  const { err } = node.config
  throw new Error(err)
}

export default execute