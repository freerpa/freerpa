/**
 * @file: 调用插件节点执行器
 * @description: 在主进程中直接加载并执行本地插件（无需 IPC 序列化传递参数）
 *              插件通过 APIContext 与工作流交互
 *              对外开放 API：complete / next / wait
 */
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const execute = async (node, context) => {
  const { pluginId } = node.config
  if (!pluginId) throw new Error('未选择插件')

  // 插件目录列表由主进程经 init 注入（engine.pluginRoots），不再直接读取 user-preferences 文件
  const pluginRoots = context.engine?.pluginRoots || []

  // 在所有已注册的插件目录中查找目标插件
  let executePath = null
  for (const dir of pluginRoots) {
    const ep = path.join(dir, pluginId, 'execute.js')
    if (fs.existsSync(ep)) {
      executePath = ep
      break
    }
  }

  if (!executePath) throw new Error('插件未找到: ' + pluginId)

  // 使用动态 import() 加载插件执行模块（ES6）
  const executeModule = await import(pathToFileURL(executePath).href)
  const executeFn = executeModule.default || executeModule.execute || executeModule

  if (typeof executeFn !== 'function') {
    throw new Error('插件 execute.js 未导出可执行函数')
  }

  // 构建 APIContext —— 插件通过此对象与工作流交互
  // 仅对外开放 complete / next / wait 三个核心方法
  const apiContext = {
    // 完成执行并输出结果到下游节点
    complete: (outputs) => {
      return context.complete(outputs)
    },

    // 跳过当前节点执行下一个节点
    next: (outputs) => {
      return context.next(outputs)
    },

    // 延时等待
    wait: (ms) => {
      return context.wait(ms)
    }
  }

  // 调用插件执行函数 —— 使用新的签名
  // execute({ inputs, outputs, config, apiContext })
  // 输出/输入定义：去快照化后 node.outputs/inputs 缺失，回退 config.__nodeIO（新约定）与 _pluginInputs/_pluginOutputs（存量）
  const nodeIO = node.config?.__nodeIO || {}
  const result = await executeFn({
    inputs: node.inputs || nodeIO.inputs || node.config?._pluginInputs || {},
    outputs: node.outputs || nodeIO.outputs || node.config?._pluginOutputs || [],
    config: node.config || {},
    apiContext
  })

  // 如果插件没有通过 apiContext.complete() 主动完成，则使用返回值自动完成
  if (result && typeof result === 'object') {
    const currentOutputs = context.getOutputs()
    if (!currentOutputs || Object.keys(currentOutputs).length === 0) {
      context.complete(result)
    }
  }
}

export default execute
