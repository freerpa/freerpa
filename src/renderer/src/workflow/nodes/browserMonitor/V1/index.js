import { RiComputerLine } from "@remixicon/vue"

export default {
  type: 'browserMonitor',
  name: '查看画面',
  icon: RiComputerLine,
  description: '实时查看浏览器画面并支持交互,常用于无头模式下的状态监控和操作干预',
  view: true,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'frameRate',
          name: '帧率',
          type: 'number',
          default: 30,
          description: '监控页面的帧率',
          quickConfig: true
        },
        {
          id: 'quality',
          name: '质量',
          type: 'number',
          default: 70,
          description: '监控画面的质量',
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
      description: '浏览器'
    }
  ],
  outputs: []
}
