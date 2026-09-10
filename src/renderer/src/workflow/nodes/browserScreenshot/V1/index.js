/**
 * @file: 网页截图节点
 */
import { IconCamera } from '@arco-design/web-vue/es/icon'

export default {
  type: 'browserScreenshot',
  name: '网页截图',
  icon: IconCamera,
  description: '网页截图节点：对浏览器页面进行全屏、指定元素或指定坐标区域截图，支持 PNG/JPEG/WebP 格式与质量设置，输出 base64 编码的图片数据。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
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
          quickConfig: true,
          description: '截图类型：fullscreen（整页全屏）/ element（指定元素）/ area（指定坐标区域）'
        },
        {
          id: 'selector',
          name: '目标元素',
          type: 'selector',
          default: '',
          description: '要截图的目标元素',
          show: '${screenshotType} === "element"',
          required: true,
          quickConfig: true
        },
        {
          id: 'area',
          name: '截图区域',
          type: 'object',
          show: '${screenshotType} === "area"',
          required: true,
          quickConfig: true,
          description: '截图区域（x/y 起点坐标 + 宽高），仅“区域截图”使用',
          fields: [
            {
              id: 'x',
              name: 'X坐标',
              type: 'number',
              default: 0,
              required: true
            },
            {
              id: 'y',
              name: 'Y坐标',
              type: 'number',
              default: 0,
              required: true
            },
            {
              id: 'width',
              name: '宽度',
              type: 'number',
              default: 800,
              required: true
            },
            {
              id: 'height',
              name: '高度',
              type: 'number',
              default: 600,
              required: true
            }
          ]
        },
        {
          id: 'imageType',
          name: '图片格式',
          type: 'radio',
          options: [
            { label: 'PNG', value: 'png' },
            { label: 'JPEG', value: 'jpeg' },
            { label: 'WebP', value: 'webp' }
          ],
          default: 'png',
          quickConfig: true,
          description: '图片格式：png / jpeg / webp'
        },
        {
          id: 'quality',
          name: '图片质量',
          type: 'number',
          min: 10,
          max: 100,
          default: 80,
          description: '图片质量（10-100），仅 JPEG/WebP 格式生效',
          show: '${imageType} !== "png"',
          required: true,
          quickConfig: true
        },
        {
          id: 'otherConfig',
          name: '其他配置',
          type: 'checkbox',
          options: [
            { label: '等待动画完成', value: 'waitForAnimations' },
            { label: '隐藏滚动条', value: 'hideScrollbar' }
          ],
          default: [],
          description: '截图附加选项：等待动画完成（截图前等待页面动画结束）/ 隐藏滚动条（截图时隐藏页面滚动条）',
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
    }
  ],
  outputs: [
    {
      id: 'result',
      name: '结果',
      type: 'string',
      description: 'base64编码的图片数据（含 data:image/xxx;base64 前缀）'
    }
  ]
}
