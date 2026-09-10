/**
 * @file: 音频预览节点
 */
import { IconMusic } from '@arco-design/web-vue/es/icon'
export default {
  type: 'previewAudio',
  name: '音频预览',
  icon: IconMusic,
  description: '音频预览节点：在节点画布上播放输入的音频（支持本地文件路径与网络地址），用于人工查看运行中间结果。',
  view: true,
  config: [],
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
