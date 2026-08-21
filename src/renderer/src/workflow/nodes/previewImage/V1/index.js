/**
 * @file: 图像预览节点
 */
import { IconImage } from '@arco-design/web-vue/es/icon'

export default {
  type: 'previewImage',
  name: '图像预览',
  icon: IconImage,
  description: '预览图像并支持图像对比',
  view: true,
  resizable: true,
  size: {
    width: 300,
    height: 400
  },
  config: [],
  inputs: [
    {
      id: 'image',
      name: '预览图',
      type: ['string', 'object'],
      description: '要预览的图像（本地、网络、base64、buffer对象）'
    },
    {
      id: 'compareImage',
      name: '对比图',
      type: ['string', 'object'],
      description: '要对比的图像（本地、网络、base64、buffer对象）'
    }
  ],
  outputs: []
}
