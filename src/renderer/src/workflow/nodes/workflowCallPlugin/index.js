/**
 * @file: 调用插件节点
 * @description: 在工作流中调用本地插件，选择插件后根据 plugin.json 动态生成
 *              inputs / outputs / config 字段
 */
import { IconApps } from '@arco-design/web-vue/es/icon'

export default {
  name: '调用插件',
  type: 'workflowCallPlugin',
  description: '调用本地安装的插件，根据插件的 plugin.json 自动生成配置项',
  icon: IconApps,
  view: true,
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
  // 动态 inputs：根据插件的 plugin.json 自动生成连线口
  inputs: [
    {
      type: 'dynamic',
      dataPath: '_pluginInputs',
      fieldMap: {
        id: 'id',
        name: 'name',
        type: 'type',
        description: 'description',
        required: 'required'
      }
    }
  ],
  // 动态 outputs：根据插件的 plugin.json 自动生成连线口
  outputs: [
    {
      type: 'dynamic',
      dataPath: '_pluginOutputs',
      fieldMap: {
        id: 'id',
        name: 'name',
        type: 'type',
        description: 'description'
      }
    }
  ]
}
