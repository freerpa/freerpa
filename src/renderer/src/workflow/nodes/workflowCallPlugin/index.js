/**
 * @file: 调用插件节点
 * @description: 在工作流中调用本地插件，动态加载插件描述文件生成配置面板
 */
import { IconApps } from '@arco-design/web-vue/es/icon'

export default {
  name: '调用插件',
  type: 'workflowCallPlugin',
  description: '调用本地安装的插件，根据插件的 plugin.json 自动生成配置项',
  icon: IconApps,
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        pluginId: {
          id: 'pluginId',
          name: '选择插件',
          type: 'select',
          default: '',
          description: '选择要调用的本地插件',
          required: true,
          options: async () => {
            try {
              const plugins = await window.electronAPI.plugin.list()
              return plugins.map((p) => ({ label: `${p.name} (v${p.version})`, value: p.id }))
            } catch (_) {
              return []
            }
          }
        }
      }
    }
  },
  inputs: [],
  outputs: []
}
