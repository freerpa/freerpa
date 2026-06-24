/**
 * @file: 重启工作流执行器
 * @author: dabao
 * @date: 2024-03-29
 */

const execute = async (node, context) => {
  const { retryFlow } = context
  try {
    await retryFlow()
  } catch (error) {
    throw error
  }
}

export default execute
