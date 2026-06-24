/**
 * @file: 音频预览节点
 * @author: AutoMan
 * @date: 2025-07-31
 */
import { IconMusic } from '@arco-design/web-vue/es/icon'
export default {
  type: 'previewAudio',
  name: '音频预览',
  icon: IconMusic,
  description: '预览音频文件',
  view: true,
  config: {},
  inputs: [
    {
      id: 'audio',
      name: '音频文件',
      type: 'string',
      description: '要预览的音频地址（本地、网络）'
    }
  ],
  outputs: []
}
