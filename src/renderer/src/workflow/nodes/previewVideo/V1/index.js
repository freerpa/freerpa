/**
 * @file: 视频预览节点
 */
import { IconLiveBroadcast } from '@arco-design/web-vue/es/icon'
export default {
  type: 'previewVideo',
  name: '视频预览',
  icon: IconLiveBroadcast,
  description: '视频预览节点：在节点画布上播放输入的视频（支持本地文件路径与网络地址），用于人工查看运行中间结果。',
  view: true,
  resizable: true,
  size: {
    width: 300,
    height: 250
  },
  config: [],
  inputs: [
    {
      id: 'video',
      name: '视频文件',
      type: 'string',
      description: '要预览的视频地址（本地、网络）'
    }
  ],
  outputs: []
}
