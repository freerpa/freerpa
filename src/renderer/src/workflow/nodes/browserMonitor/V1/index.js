import { RiComputerLine } from "@remixicon/vue"

export default {
  type: 'browserMonitor',
  name: '查看画面',
  icon: RiComputerLine,
  description: '查看画面节点：通过 CDP 推流实时查看浏览器画面，并支持鼠标点击/移动/滚轮、键盘输入、页面跳转等交互操作，常用于无头模式下的状态监控与操作干预。',
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
          description: '画面推流帧率（1-60，默认 30）',
          quickConfig: true
        },
        {
          id: 'quality',
          name: '质量',
          type: 'number',
          default: 70,
          description: '画面推流画质（1-100，默认 70）',
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
      description: '浏览器页面对象（来自“打开浏览器”节点）'
    }
  ],
  outputs: []
}
