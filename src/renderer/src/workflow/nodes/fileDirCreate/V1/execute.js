/**
 * @file: 文件保存节点执行器
 * @author: dabao
 * @date: 2024-03-24
 */
// 执行器
const execute = async (node, context) => {
  const { dirPath } = node.config
  const { complete, fs } = context
  let resultPath = dirPath // catch 内需要改写，不能用 const
  try {
    // 保存文件
    try {
      fs.mkdirSync(dirPath, { recursive: true })
      // 使用 complete 方法返回结果并继续执行
    } catch (error) {
      resultPath = ''
    }

    complete({
      result: resultPath
    })
  } catch (error) {
    throw error
  }
}

export default execute
