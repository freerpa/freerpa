/**
 * @file: 视频预览节点
 */
import { IconLiveBroadcast } from '@arco-design/web-vue/es/icon'
export default {
  type: 'previewVideo',
  name: '视频预览',
  icon: IconLiveBroadcast,
  description: '预览视频文件',
  view: true,
  resizable: true,
  size: {
    width: 300,
    height: 250
  },
  config: {},
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
