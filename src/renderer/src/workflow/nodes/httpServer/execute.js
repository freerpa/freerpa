/**
 * @file: HTTP服务节点执行器
 * @author: Auto Generated
 * @date: 2024-03-15
 */
import { processParams } from '@/common'
const execute = async ({ config, inputs }, context) => {
  try {
    const { route = '/' } = config
    const { next, onBeforeDestroy, executeSubFlow, sendNodeEvent, runCode } = context
    const handler = async (req) => {
      const reqParams = req.url.searchParams.keys().reduce((prev, cur) => {
        prev[cur] = req.url.searchParams.get(cur)
        return prev
      }, {})

      const { params = [], config: configParams = [] } = config
      //输入处理（没有输入参数，直接使用默认值）
      const inputsOutputs = processParams(params, inputs, runCode)
      //配置参数处理（取对应类型值）
      const configOutputs = configParams.reduce((acc, param) => {
        acc[param.name] = param[param.type + 'Value']
        return acc
      }, {})

      const result = await executeSubFlow({
        ...inputsOutputs,
        ...configOutputs,
        params: reqParams
      })
      return result
    }
    global.httpServer.createRouter('GET', route, handler)
    
    const url = `http://localhost:${global.httpServer.port}${route}`
    // 发送输出事件到渲染进程
    sendNodeEvent(url)
    next({ url })

    onBeforeDestroy(() => {
      global.httpServer.removeRouter('GET', route, handler)
    })
  } catch (error) {
    throw error
  }
}

export default execute
