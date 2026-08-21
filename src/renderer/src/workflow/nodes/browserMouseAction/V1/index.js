/**
 * @file: 鼠标操作节点
 */
import { RiCursorLine } from "@remixicon/vue";

export default {
  type: 'browserMouseAction',
  name: '鼠标操作',
  icon: RiCursorLine,
  description: '模拟鼠标操作',
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
          description: '要操作的目标元素',
          required: true,
          quickConfig: true
        },
        {
          id: 'action',
          name: '操作类型',
          type: 'select',
          options: [
            { label: '单击', value: 'click' },
            { label: '双击', value: 'dblclick' },
            { label: '右键', value: 'rightClick' },
            { label: '悬停', value: 'hover' },
            { label: '拖拽', value: 'drag' },
            { label: '滚轮', value: 'wheel' },
          ],
          default: 'click',
          description: '鼠标操作类型',
          quickConfig: true
        },
        {
          id: 'wheelDeltaX',
          name: '水平滚动',
          type: 'number',
          default: 0,
          description: '滚轮水平滚动的距离',
          show: "${action} === 'wheel'",
          quickConfig: true
        },
        {
          id: 'wheelDeltaY',
          name: '垂直滚动',
          type: 'number',
          default: 0,
          description: '滚轮垂直滚动的距离',
          show: "${action} === 'wheel'",
          quickConfig: true
        },
        {
          id: 'clickAll',
          name: '点击全部',
          type: 'switch',
          default: false,
          quickConfig: true,
          description: '是否点击全部匹配的元素，否则仅点击第一个匹配的元素',
          show: "${action} === 'click' || ${action} === 'dblclick' || ${action} === 'rightClick'"
        },
        {
          id: 'delay',
          name: '延迟时间',
          type: 'number',
          min: 0,
          default: 500,
          description: '操作前的延迟时间(毫秒)'
        },
        {
          id: 'interval',
          name: '点击间隔',
          type: 'number',
          min: 0,
          default: 100,
          description: '多个元素点击的间隔时间(毫秒)',
          show: '${clickAll}',
          quickConfig: true
        },
        {
          id: 'dragConfigTips',
          name: '拖拽配置提示',
          show: "${action} === 'drag'",
          nolabel: true,
          type: 'alert',
          quickConfig: true,
          onlyQuick: true,
          description: '点击右上角查看完整拖拽配置'
        },
        {
          id: 'dragConfig',
          name: '拖拽配置',
          description: '拖拽操作的配置',
          type: 'object',
          show: "${action} === 'drag'",
          fields: [
            {
              id: 'target',
              name: '目标元素',
              type: 'selector',
              description: '拖拽的目标位置'
            },
            {
              id: 'pathMode',
              name: '路径模式',
              type: 'radio',
              options: [
                { label: '直接拖拽', value: 'direct' },
                { label: '自定义路径', value: 'custom' }
              ],
              default: 'direct',
              description: '拖拽路径的模式'
            },
            {
              id: 'pathPoints',
              name: '路径点',
              type: 'array',
              show: "${pathMode} === 'custom'",
              fields: [
                {
                  id: 'x',
                  name: 'X坐标',
                  type: 'number',
                  description: '相对起点的X轴偏移(像素)'
                },
                {
                  id: 'y',
                  name: 'Y坐标',
                  type: 'number',
                  description: '相对起点的Y轴偏移(像素)'
                },
                {
                  id: 'delay',
                  name: '停留时间',
                  type: 'number',
                  min: 0,
                  default: 0,
                  description: '在该点的停留时间(毫秒)'
                }
              ],
              description: '拖拽经过的路径点'
            },
            {
              id: 'duration',
              name: '拖拽时长',
              type: 'number',
              min: 0,
              default: 1000,
              description: '拖拽动作持续时间(毫秒)'
            }
          ]
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
  outputs: [
  ]
}
