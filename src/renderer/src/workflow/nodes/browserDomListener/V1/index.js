/**
 * @file: DOM监听节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconEye } from '@arco-design/web-vue/es/icon'

export default {
  type: 'browserDomListener',
  name: '元素监听',
  icon: IconEye,
  description: '监听DOM元素的变化（常驻监听，需 workflowEnd 或手动停止结束流程）（持续监听元素状态变化；一次性快照请用「元素状态」节点）',
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
          description: '要监听的目标元素',
          quickConfig: true
        },
        types: {
          id: 'types',
          name: '监听类型',
          type: 'select',
          options: [
            { label: '元素存在', value: 'exists' },
            { label: '元素不存在', value: 'notExists' },
            { label: '元素可见', value: 'visible' },
            { label: '元素不可见', value: 'notVisible' },
            { label: '在视口内', value: 'inViewport' },
            { label: '不在视口内', value: 'notInViewport' },
            { label: '属性变化', value: 'attributes' },
            { label: '位置变化', value: 'position' },
            { label: '尺寸变化', value: 'size' },
            { label: '文本内容变化', value: 'content' },
            { label: 'HTML变化', value: 'html' },
            { label: '输入值变化', value: 'value' },
            { label: '子项数量变化', value: 'childNodes' }
          ],
          multiple: true,
          default: [],
          description: '要监听的变化类型',
          required: true,
          quickConfig: true
        },
        interval: {
          id: 'interval',
          name: '检查间隔',
          type: 'number',
          min: 50,
          max: 5000,
          default: 1000,
          description: '检查状态的时间间隔(毫秒)',
          quickConfig: true
        },
        isContinuous: {
          id: 'isContinuous',
          name: '持续监听',
          type: 'switch',
          default: true,
          description: '是否持续监听元素变化',
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
  outputs: []
}
