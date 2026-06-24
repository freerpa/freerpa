/**
 * @file: 自定义节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import { page_eval } from '@pageEval'
import { processParams } from '@/common'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, nodeId, onBeforeDestroy, runCode } = context
  try {
    // 获取代码配置
    const { code, params } = config
    const myConfig = processParams(params, {}, runCode)
    // 生成唯一函数名
    const completeFnName = 'cb' + nodeId.replaceAll('-', '')

    // 如果浏览器丢失连接，则重新连接
    if (!global.browser.connected) {
      await global.pptrConnect()
    }

    // 如果页面或者session断开，则重新创建页面环境
    if (global.bvm.isClosed() || global.bvm.target()._session().detached) {
      console.log('重新创建')
      await global.createBvm()
    }

    // 移除已存在的函数
    try {
      await global.bvm.removeExposedFunction(completeFnName)
    } catch (error) {
      // console.log(error)
    }
    // 暴露 Node.js 函数给页面
    await global.bvm.exposeFunction(completeFnName, (outputs) => {
      complete(outputs)
    })
    // 执行代码
    await page_eval(
      global.bvm,
      `async (completeFnName, inputs, config) => {
        const complete = window[completeFnName]
        ${code}
      }`,
      completeFnName,
      processParams(config.inputs, inputs, runCode),
      myConfig
    )

    // 在节点销毁前执行清理
    onBeforeDestroy(async () => {
      try {
        await global.bvm.removeExposedFunction(completeFnName)
      } finally {
      }
    })
  } catch (error) {
    throw error
  }
}

export default execute
