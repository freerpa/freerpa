/**
 * @file: 页面滚动节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { RiScrollToBottomLine } from "@remixicon/vue";

export default {
  type: 'pageScroll',
  name: '页面滚动',
  icon: RiScrollToBottomLine,
  description: '控制页面或指定元素的滚动',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        scrollType: {
          id: 'scrollType',
          name: '滚动类型',
          type: 'select',
          options: [
            { label: '滚动到元素', value: 'element' },
            { label: '滚动到位置', value: 'position' },
            { label: '滚动到底部', value: 'bottom' },
            { label: '滚动到顶部', value: 'top' },
            { label: '自动滚动', value: 'auto' }
          ],
          default: 'element',
          description: '滚动的方式',
          quickConfig: true,
          required: true
        },
        scrollArea: {
          id: 'scrollArea',
          name: '滚动区域',
          type: 'selector',
          description: '要滚动的区域,默认为整个页面',
          quickConfig: true,
          required: false
        },
        selector: {
          id: 'selector',
          name: '目标元素',
          type: 'selector',
          description: '要滚动到的目标元素',
          required: true,
          quickConfig: true,
          show: "${scrollType} == 'element'"
        },
        behavior: {
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
        position: {
          id: 'position',
          name: '滚动位置',
          type: 'object',
          show: "${scrollType} === 'position'",
          fields: {
            x: {
              id: 'x',
              name: '水平位置',
              type: 'number',
              default: 0,
              description: '水平滚动位置(正数向右/负数向左)'
            },
            y: {
              id: 'y',
              name: '垂直位置',
              type: 'number',
              default: 0,
              description: '垂直滚动位置(正数向下/负数向上)'
            },
            relative: {
              id: 'relative',
              name: '相对位置',
              type: 'switch',
              default: false,
              description: '是否相对于当前位置滚动'
            }
          },
          quickConfig: true,
          show: "${scrollType} == 'position'"
        },
        direction: {
          id: 'direction',
          name: '滚动方向',
          type: 'select',
          options: [
            { label: '向下滚动', value: 'down' },
            { label: '向上滚动', value: 'up' },
            { label: '向右滚动', value: 'right' },
            { label: '向左滚动', value: 'left' }
          ],
          default: 'down',
          description: '自动滚动的方向',
          quickConfig: true,
          show: "${scrollType} == 'auto'"
        },
        step: {
          id: 'step',
          name: '滚动步长',
          type: 'number',
          min: 1,
          default: 100,
          description: '每次滚动的距离(px)',
          quickConfig: true,
          show: "${scrollType} == 'auto'"
        },
        interval: {
          id: 'interval',
          name: '滚动间隔',
          type: 'number',
          min: 10,
          default: 100,
          description: '滚动的时间间隔(ms)',
          quickConfig: true,
          show: "${scrollType} == 'auto'"
        },
        duration: {
          id: 'duration',
          name: '持续时间',
          type: 'number',
          min: 0,
          step: 1000,
          default: 5000,
          description: '自动滚动的持续时间(ms)',
          quickConfig: true,
          show: "${scrollType} == 'auto'"
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
