/**
 * @file: 图像预览节点
 */
import { IconImage } from '@arco-design/web-vue/es/icon'

export default {
  type: 'previewImage',
  name: '图像预览',
  icon: IconImage,
  description: '图像预览节点：在节点画布上显示输入的图像（支持本地路径/网络地址/base64/Buffer），并可同时传入对比图进行并排对比，用于人工核验。',
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
