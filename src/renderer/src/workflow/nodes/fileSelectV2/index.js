/**
 * @file: 文件上传节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconUpload } from '@arco-design/web-vue/es/icon'

export default {
  type: 'fileSelectV2',
  name: '文件上传',
  icon: IconUpload,
  description: '在网页中上传文件',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        selector: {
          id: 'selector',
          name: '目标元素',
          type: 'selector',
          required: true,
          description: '上传按钮或拖放区域的选择器',
          quickConfig: true
        },
        forceDrop: {
          id: 'forceDrop',
          name: '强制拖放',
          type: 'switch',
          default: false,
          description: '是否强制使用拖放模式上传文件,默认自动识别',
          quickConfig: true
        }
      }
    }
  },
  inputs: [
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      required: true
    },
    {
      id: 'filePath',
      name: '文件路径',
      type: ['string', 'array'],
      required: true,
      description: '要上传的文件路径(单、多文件或者文件夹)'
    }
  ],
  outputs: [
    {
      id: 'fileCount',
      name: '文件数量',
      type: 'number',
      description: '上传的文件数量'
    }
  ]
}
