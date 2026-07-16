/**
 * @file: 调用插件节点执行器
 * @description: 在主进程中直接加载并执行本地插件（无需 IPC 序列化传递参数）
 *              插件通过 APIContext 与工作流交互
 */
import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const execute = async (node, context) => {
  const { pluginId } = node.config
  if (!pluginId) throw new Error('未选择插件')

  // 从本地存储读取插件目录列表
  const userDataPath = app.getPath('userData')
  const storePath = path.join(userDataPath, 'user-preferences')
  let pluginDirs = []
  try {
    if (fs.existsSync(storePath)) {
      pluginDirs = JSON.parse(fs.readFileSync(storePath, 'utf-8')).pluginDirs || []
    }
  } catch (_) {
    pluginDirs = []
  }

  // 在所有已注册的插件目录中查找目标插件
  let executePath = null
  for (const dir of pluginDirs) {
    const ep = path.join(dir, pluginId, 'execute.js')
    if (fs.existsSync(ep)) {
      executePath = ep
      break
    }
  }

  if (!executePath) throw new Error('插件未找到: ' + pluginId)

  // 清除 require 缓存以支持热更新
  try {
    const resolvedPath = require.resolve(executePath)
    delete require.cache[resolvedPath]
  } catch (_) {}

  // 加载插件执行模块
  const executeModule = require(executePath)
  const executeFn = executeModule.default || executeModule.execute || executeModule

  if (typeof executeFn !== 'function') {
    throw new Error('插件 execute.js 未导出可执行函数')
  }

  // 构建 APIContext —— 插件通过此对象与工作流交互
  const apiContext = {
    nodeId: node.id,

    // 完成执行并输出结果到下游节点
    complete: (outputs) => {
      return context.complete(outputs)
    },

    // 设置单个输出字段
    setOutput: (key, value) => {
      const outputs = context.getOutputs()
      outputs[key] = value
      context.setOutputs(outputs)
    },

    // 获取输入字段值
    getInput: (key) => {
      return node.inputs?.[key]
    },

    // 获取配置字段值
    getConfig: (key) => {
      return node.config?.[key]
    },

    // 延时等待
    wait: (ms) => {
      return context.wait(ms)
    },

    // 日志输出
    log: (message) => {
      console.log(`[Plugin:${pluginId}]`, message)
    },

    // 文件系统操作（来自标准 NodeExecutor context）
    fs: context.fs,

    // 全局共享存储
    global: context.global,

    // 停止整个工作流
    stopWorkflow: (outputs) => {
      return context.stopWorkflow(outputs)
    }
  }

  // 调用插件执行函数 —— 使用新的签名
  // execute({ inputs, outputs, config, apiContext })
  const result = await executeFn({
    inputs: node.inputs || {},
    outputs: node.outputs || [],
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
