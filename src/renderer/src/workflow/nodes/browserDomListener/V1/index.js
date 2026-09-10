/**
 * @file: DOM监听节点
 */
import { IconEye } from '@arco-design/web-vue/es/icon'

export default {
  type: 'browserDomListener',
  name: '元素监听',
  icon: IconEye,
  description: '元素监听节点：按固定间隔轮询检查目标元素的状态（存在/可见/视口/属性/位置/尺寸/文本/HTML/输入值/子项数量等），任一监听项的状态发生变化时触发后续节点。',
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
          description: '要监听的目标元素',
          quickConfig: true
        },
        {
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
          description: '要监听的变化类型（可多选）：元素存在/不存在、可见/不可见、在视口内/外、属性/位置/尺寸/文本/HTML/输入值/子项数量变化',
          required: true,
          quickConfig: true
        },
        {
          id: 'interval',
          name: '检查间隔',
          type: 'number',
          min: 50,
          max: 5000,
          default: 1000,
          description: '检查状态的时间间隔(毫秒)',
          quickConfig: true
        },
        {
          id: 'isContinuous',
          name: '持续监听',
          type: 'switch',
          default: true,
          description: '是否持续监听元素变化（否则状态变化一次后结束节点）',
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
  outputs: []
}
