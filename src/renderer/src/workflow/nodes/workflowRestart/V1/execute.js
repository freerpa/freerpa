/**
 * @file: 重启工作流执行器
 */

const execute = async (node, context) => {
  const { retryFlow } = context
  
  await retryFlow()

}

export default execute
