/**
 * @file: DOM监听节点
 */

import { RiNewsLine } from "@remixicon/vue";

export default {
  type: 'browserElementState',
  name: '元素状态',
  icon: RiNewsLine,
  description: '获取指定元素的状态信息（常驻监听，需 workflowEnd 或手动停止结束流程）（一次性状态快照；持续监听请用「DOM 监听」节点）',
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
          description: '要获取状态的目标元素',
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
      required: true
    }
  ],
  outputs: [
    {
      id: 'exists',
      name: '是否存在',
      description: '元素是否存在',
      type: 'boolean',
      required: true
    },
    {
      id: 'visible',
      name: '是否可见',
      description: '元素是否在页面中可见',
      type: 'boolean',
      required: true
    },
    {
      id: 'inViewport',
      name: '在视口内',
      description: '元素是否在可视范围内',
      type: 'boolean',
      required: true
    },
    {
      id: 'rect',
      name: '位置大小',
      description: '元素的位置和大小信息',
      type: 'object',
      required: true
    }
  ]
}
