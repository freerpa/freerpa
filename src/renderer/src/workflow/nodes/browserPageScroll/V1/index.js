/**
 * @file: 页面滚动节点
 */
import { RiScrollToBottomLine } from "@remixicon/vue";

export default {
  type: 'browserPageScroll',
  name: '页面滚动',
  icon: RiScrollToBottomLine,
  description: '控制页面或指定元素的滚动',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'scrollType',
          name: '滚动类型',
          type: 'select',
          options: [
            { label: '滚动到元素', value: 'element' },
            { label: '滚动到位置', value: 'position' },
            { label: '滚动到边', value: 'edge' },
            { label: '持续滚动', value: 'continuous' }
          ],
          default: 'element',
          description: '滚动的方式',
          quickConfig: true,
          required: true
        },
        {
          id: 'scrollArea',
          name: '滚动区域',
          type: 'selector',
          description: '要滚动的区域,默认为整个页面',
          quickConfig: true,
          required: false
        },
        {
          id: 'behavior',
          name: '滚动行为',
          type: 'select',
          options: [
            { label: '平滑滚动', value: 'smooth' },
            { label: '瞬间跳转', value: 'instant' }
          ],
          default: 'smooth',
          description: '滚动的动画效果',
          quickConfig: true
        },
        {
          id: 'selector',
          name: '目标元素',
          type: 'selector',
          description: '要滚动到的目标元素',
          required: true,
          quickConfig: true,
          show: "${scrollType} == 'element'"
        },
        {
          id: 'x',
          name: '水平位置',
          type: 'number',
          show: "${scrollType} == 'position'",
          default: 0,
          required: true,
          quickConfig: true,
          description: '水平滚动位置(正数向右/负数向左)'
        },
        {
          id: 'y',
          name: '垂直位置',
          type: 'number',
          default: 0,
          required: true,
          quickConfig: true,
          show: "${scrollType} == 'position'",
          description: '垂直滚动位置(正数向下/负数向上)'
        },
        {
          id: 'relative',
          name: '相对位置',
          type: 'switch',
          default: false,
          required: true,
          quickConfig: true,
          show: "${scrollType} == 'position'",
          description: '是否相对于当前位置滚动'
        },
        {
          id: 'direction',
          name: '滚动方向',
          type: 'radio',
          options: [
            { label: '上', value: 'up' },
            { label: '下', value: 'down' },
            { label: '左', value: 'left' },
            { label: '右', value: 'right' }
          ],
          default: 'down',
          description: '持续滚动的方向',
          quickConfig: true,
          show: "['continuous', 'edge'].includes(${scrollType})"
        },
        {
          id: 'step',
          name: '步进距离',
          type: 'number',
          min: 1,
          default: 100,
          description: '每次滚动的距离(px)',
          quickConfig: true,
          show: "${scrollType} == 'continuous'"
        },
        {
          id: 'interval',
          name: '滚动间隔',
          type: 'number',
          min: 10,
          default: 100,
          description: '每次滚动的时间间隔(ms)',
          quickConfig: true,
          show: "${scrollType} == 'continuous'"
        },
        {
          id: 'bounce',
          name: '往复滚动',
          type: 'switch',
          default: false,
          description: '到达边界后反向滚动',
          quickConfig: true,
          show: "${scrollType} == 'continuous'"
        },
        {
          id: 'stopStrategy',
          name: '停止策略',
          type: 'select',
          options: [
            { label: '触边次数', value: 'edgeCount' },
            { label: '持续时间', value: 'duration' },
            { label: '无限滚动', value: 'infinite' }
          ],
          default: 'duration',
          description: '滚动停止的条件',
          quickConfig: true,
          show: "${scrollType} == 'continuous'"
        },
        {
          id: 'edgeCount',
          name: '触边次数',
          type: 'number',
          min: 1,
          default: 2,
          description: '到达边界的次数后停止',
          quickConfig: true,
          show: "${scrollType} == 'continuous' && ${stopStrategy} == 'edgeCount'"
        },
        {
          id: 'duration',
          name: '持续时间',
          type: 'number',
          min: 1000,
          step: 1000,
          default: 5000,
          description: '持续滚动的时间(ms)',
          quickConfig: true,
          show: "${scrollType} == 'continuous' && ${stopStrategy} == 'duration'"
        }
      ]
    }
  ],
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
