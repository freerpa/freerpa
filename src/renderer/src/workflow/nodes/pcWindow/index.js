/**
 * @file: 桌面窗口操作节点
 * @author: AutoMan
 * @date: 2025-10-09
 */
import { IconDesktop } from '@arco-design/web-vue/es/icon'
export default {
  type: 'pcWindow',
  name: '窗口操作',
  icon: IconDesktop,
  description: '在桌面执行窗口操作',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        window: {
          id: 'window',
          name: '窗口',
          type: 'select',
          options: [],
          remote: true,
          remoteMethod: async (keyWord) => {
            const windows = await window.electronAPI.system.getWindows(keyWord)
            console.log('windows', windows);
            return windows
          },
          description: '窗口对象',
          default: '',
          quickConfig: true,
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'window',
      name: '窗口',
      type: 'window',
      description: '窗口对象'
    }
  ]
}
