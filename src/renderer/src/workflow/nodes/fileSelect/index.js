/**
 * @file: 文件上传节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconUpload } from '@arco-design/web-vue/es/icon'

export default {
  type: 'fileSelect',
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
        filePath: {
          id: 'filePath',
          name: '文件路径',
          type: 'path',
          required: true,
          description: '要选择的文件夹路径',
          quickConfig: true
        },
        isDrop: {
          id: 'isDrop',
          name: '是否拖放',
          type: 'switch',
          default: false,
          description: '模拟拖放文件，一般用于无法准确定位上传按钮的场景',
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
    }
  ],
  outputs: []
}
