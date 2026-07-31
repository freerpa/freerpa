/**
 * @file: 自定义节点执行器
 * @author: dabao / FreeRPA
 * @date: 2024-03-29
 */
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

    // 如果页面已销毁，则重新创建页面环境
    if (!global.bvmWebContents || global.bvmWebContents.isDestroyed()) {
      console.log('重新创建')
      await global.createBvm()
    }

    // 移除已存在的回调
    global.removeBvmCallback(completeFnName)

    // 注册回调：通过 IPC 接收页面发回的完成信号
    global.registerBvmCallback(completeFnName, (outputs) => {
      complete(outputs)
    })

    // 在页面中注入回调函数，通过 preload 的 __bvmIpc 调用主进程
    const injectFnCode = `
      window.${completeFnName} = async (outputs) => {
        try {
          const safeOutputs = JSON.parse(JSON.stringify(outputs))
          return await window.__bvmIpc.invoke('bvm:callback', '${completeFnName}', safeOutputs)
        } catch(e) {
          console.error('BVM callback error:', e)
        }
      };
      void 0;
    `
    await global.bvmWebContents.executeJavaScript(injectFnCode)

    // 执行用户代码
    const inputsJson = JSON.stringify(processParams(config.inputs, inputs, runCode))
    const configJson = JSON.stringify(myConfig)
    const userCode = `
      (async () => {
        const complete = window['${completeFnName}']
        const inputs = ${inputsJson}
        const config = ${configJson}
        ${code}
      })();
      void 0;
    `
    await global.bvmWebContents.executeJavaScript(userCode)

    // 在节点销毁前清理
    onBeforeDestroy(async () => {
      try {
        global.removeBvmCallback(completeFnName)
        await global.bvmWebContents.executeJavaScript(`delete window.${completeFnName}`)
      } catch (_) {}
    })
  } catch (error) {
    throw error
  }
}

export default execute
