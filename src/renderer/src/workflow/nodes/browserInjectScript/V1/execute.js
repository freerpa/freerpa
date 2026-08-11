/**
 * @file: JavaScript注入节点执行器
 */
import { page_eval } from '@pageEval'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  const page = inputs.page
  let result = null

  
  const { code = '' } = config
  // 执行脚本

  result = await page_eval(
    page,
    `async (code) => {
      try {
        // 使用async函数包装执行,支持await
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
        const fn = new AsyncFunction(code)
        return await fn()
      } catch (error) {
        throw new Error('代码执行错误: ' + error.message)
      }
    }`,
    code
  )

  // 发送结果
  complete({
    // page,
    result
  })

}

export default execute
