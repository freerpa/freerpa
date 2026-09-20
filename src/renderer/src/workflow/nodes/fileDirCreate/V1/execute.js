/**
 * @file: 文件保存节点执行器
 */
import fs from 'node:fs'

// 执行器
const execute = async (node, context) => {
  const { dirPath } = node.config
  const { complete } = context
  let resultPath = dirPath // catch 内需要改写，不能用 const
  
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

}

export default execute
