/**
 * @file: 自定义节点执行器（worker 版）
 * 用户代码在 deno Worker 内直接执行，隔离由权限模型保证（最小权限）；
 * complete/inputs/config 语义与 BVM 版一致。
 */
import { processParams } from '@/common'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, runCode } = context
  try {
    const { code, params = [], inputs: inputParams = [] } = config
    const myConfig = processParams(params, {}, runCode)
    const ins = processParams(inputParams, inputs, runCode)

    // 用户代码内调用 complete(outputs) 或异步返回后完成节点；错误向上传播
    await new Promise((resolve, reject) => {
      let settled = false
      const done = (outputs) => {
        if (settled) return
        settled = true
        complete(outputs)
        resolve()
      }
      const run = new Function('complete', 'inputs', 'config', `return (async () => { ${code} })()`)
      run(done, ins, myConfig)
        .then(() => {
          if (!settled) {
            settled = true
            complete()
            resolve()
          }
        })
        .catch((e) => {
          if (!settled) {
            settled = true
            reject(e)
          }
        })
    })
  } catch (error) {
    throw error
  }
}

export default execute
