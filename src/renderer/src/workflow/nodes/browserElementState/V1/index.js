/**
 * @file: DOM监听节点
 */

import { RiNewsLine } from "@remixicon/vue";

export default {
  type: 'browserElementState',
  name: '元素状态',
  icon: RiNewsLine,
  description: '元素状态节点：检查页面元素是否存在、是否可见、是否在视口内，并输出其位置大小信息，常用于流程中判断元素是否就绪或轮询等待。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'selector',
          name: '目标元素',
          type: 'selector',
          required: true,
          description: '要获取状态的目标元素',
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
