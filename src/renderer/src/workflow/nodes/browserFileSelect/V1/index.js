/**
 * @file: 文件上传节点
 */
import { IconUpload } from '@arco-design/web-vue/es/icon'

export default {
  type: 'browserFileSelect',
  name: '文件上传',
  icon: IconUpload,
  description: '文件上传节点：在网页中上传本地文件（支持单个/多个文件与文件夹，文件夹自动递归收集）。目标为 file 类型 input 时直接上传，否则模拟拖放上传；输出上传的文件数量。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'selector',
          name: '目标元素',
          type: 'selector',
          required: true,
          description: '上传按钮或拖放区域的选择器',
          quickConfig: true
        },
        {
          id: 'forceDrop',
          name: '强制拖放',
          type: 'switch',
          default: false,
          description: '是否强制使用拖放模式上传（默认自动识别：file 类型 input 用直传，其它元素用拖放）',
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      required: true,
      description: '浏览器页面对象（来自“打开浏览器”节点）'
    },
    {
      id: 'filePath',
      name: '文件路径',
      type: ['string', 'array'],
      required: true,
      description: '要上传的文件路径（单个文件/多个文件/文件夹）'
    }
  ],
  outputs: [
    {
      id: 'fileCount',
      name: '文件数量',
      type: 'number',
      description: '实际上传的文件数量'
    }
  ]
}
