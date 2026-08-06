/**
 * @file: HTTP服务节点执行器
 * @author: Auto Generated
 * @date: 2024-03-15
 */
import { processParams, getHttpServer } from '@/common'

const execute = async ({ config, inputs }, context) => {
  try {
    const { route = '/' } = config
    const { next, onBeforeDestroy, executeSubFlow, sendNodeEvent, runCode, global } = context
    const handler = async (req) => {
      const reqUrl = new URL(req.url, 'http://localhost')
      const reqParams = reqUrl.searchParams.keys().reduce((prev, cur) => {
        prev[cur] = reqUrl.searchParams.get(cur)
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
    // worker 内自建共享 HTTP server（挂 engine.global.httpServer，跨节点共享；替代原未注入的 global.httpServer）
    const httpServer = await getHttpServer(global)
    httpServer.createRouter('GET', route, handler)

    const url = `http://localhost:${httpServer.port}${route}`
    // 发送输出事件到渲染进程
    sendNodeEvent(url)
    next({ url })

    onBeforeDestroy(() => {
      httpServer.removeRouter('GET', route)
    })
  } catch (error) {
    throw error
  }
}

export default execute
