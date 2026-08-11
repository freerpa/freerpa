/**
 * @file: 新页面打开事件节点
 */
import { RiWindowLine } from "@remixicon/vue";

export default {
  type: 'browserOnNewPage',
  name: '监听新页面',
  icon: RiWindowLine,
  description: '监听新页面打开事件（常驻监听，需 workflowEnd 或手动停止结束流程）',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        closePage: {
          id: 'closePage',
          name: '关闭页面',
          type: 'switch',
          default: false,
          description: '是否关闭新打开的页面',
          quickConfig: true
        },
        isContinuous: {
          id: 'isContinuous',
          name: '持续监听',
          type: 'switch',
          default: true,
          description: '是否持续监听新页面打开事件',
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
  outputs: [
    {
      id: 'url',
      name: 'URL',
      type: 'string',
      description: '新打开页面的URL'
    }
  ]
}
