import { RiComputerLine } from "@remixicon/vue"

export default {
  type: 'browserMonitor',
  name: '网页监控',
  icon: RiComputerLine,
  description: '实时抓取网页画面并支持交互,常用于无头模式下的状态监控和操作干预（常驻监听，需 workflowEnd 或手动停止结束流程）',
  view: true,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        frameRate: {
          id: 'frameRate',
          name: '帧率',
          type: 'number',
          default: 30,
          description: '监控页面的帧率',
          quickConfig: true
        },
        quality: {
          id: 'quality',
          name: '质量',
          type: 'number',
          default: 70,
          description: '监控画面的质量',
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
      description: '浏览器'
    }
  ],
  outputs: []
}
