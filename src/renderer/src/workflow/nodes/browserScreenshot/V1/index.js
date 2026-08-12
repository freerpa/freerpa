/**
 * @file: 网页截图节点
 */
import { IconCamera } from '@arco-design/web-vue/es/icon'

export default {
  type: 'browserScreenshot',
  name: '网页截图',
  icon: IconCamera,
  description: '支持全屏截图、元素选择截图、指定区域截图',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        screenshotType: {
          id: 'screenshotType',
          name: '截图类型',
          type: 'select',
          options: [
            { label: '全屏截图', value: 'fullscreen' },
            { label: '元素截图', value: 'element' },
            { label: '区域截图', value: 'area' }
          ],
          default: 'fullscreen',
          required: true,
          quickConfig: true
        },
        selector: {
          id: 'selector',
          name: '目标元素',
          type: 'selector',
          default: '',
          description: '要截图的目标元素',
          show: '${screenshotType} === "element"',
          required: true,
          quickConfig: true
        },
        area: {
          id: 'area',
          name: '截图区域',
          type: 'object',
          show: '${screenshotType} === "area"',
          required: true,
          quickConfig: true,
          fields: {
            x: {
              id: 'x',
              name: 'X坐标',
              type: 'number',
              default: 0,
              required: true
            },
            y: {
              id: 'y',
              name: 'Y坐标',
              type: 'number',
              default: 0,
              required: true
            },
            width: {
              id: 'width',
              name: '宽度',
              type: 'number',
              default: 800,
              required: true
            },
            height: {
              id: 'height',
              name: '高度',
              type: 'number',
              default: 600,
              required: true
            }
          }
        },
        imageType: {
          id: 'imageType',
          name: '图片格式',
          type: 'radio',
          options: [
            { label: 'PNG', value: 'png' },
            { label: 'JPEG', value: 'jpeg' },
            { label: 'WebP', value: 'webp' }
          ],
          default: 'png',
          quickConfig: true
        },
        quality: {
          id: 'quality',
          name: '图片质量',
          type: 'number',
          min: 10,
          max: 100,
          default: 80,
          description: '图片质量(1-100)',
          show: '${imageType} !== "png"',
          required: true,
          quickConfig: true
        },
        otherConfig: {
          id: 'otherConfig',
          name: '其他配置',
          type: 'checkbox',
          options: [{ label: '等待动画完成', value: 'waitForAnimations' }],
          default: [],
          description: '',
          quickConfig: true
        }
      }
    }
  },
  inputs: [
    {
      id: 'page',
      name: '网页',
      type: 'page',
      required: true,
      description: '浏览器'
    }
  ],
  outputs: [
    {
      id: 'result',
      name: '结果',
      type: 'string',
      description: 'base64编码的图片数据'
    }
  ]
}
