/**
 * @file: 调用插件节点执行器
 * @description: 从主进程加载并执行本地插件
 */

import { ipcRenderer } from 'electron'

const execute = async (node, context) => {
  const { pluginId } = node.config
  if (!pluginId) throw new Error('未选择插件')

  try {
    const result = await ipcRenderer.invoke('plugin:execute', {
      pluginId,
      node: {
        id: node.id,
        name: node.name,
        type: node.type,
        config: node.config,
        inputs: node.inputs,
        outputs: node.outputs,
        store: node.store
      }
    })

    if (result.error) throw new Error(result.error)

    const outputs = result.outputs || {}
    context.complete(outputs)
  } catch (error) {
    throw error
  }
}

export default execute
