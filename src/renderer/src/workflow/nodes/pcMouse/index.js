/**
 * @file: 桌面鼠标操作节点
 * @author: AutoMan
 * @date: 2025-10-09
 */
import { IconDragArrow } from '@arco-design/web-vue/es/icon'

export default {
  type: 'pcMouse',
  name: '鼠标操作',
  icon: IconDragArrow,
  description: '在桌面执行鼠标操作',
  config: {
    basic: {
      name: '基础配置',
      fields: {
        type: {
          id: 'type',
          name: '操作类型',
          type: 'select',
          options: [
            { label: '单击', value: 'click' },
            { label: '移动', value: 'move' },
            { label: '滚轮', value: 'wheel' },
            { label: '右击', value: 'rightClick' },
            { label: '双击', value: 'doubleClick' },
            { label: '自定义', value: 'custom' }
          ],
          default: 'click',
          description: '选择要执行的鼠标操作',
          quickConfig: true
        },
        position: {
          id: 'position',
          name: '操作位置',
          type: 'position',
          default: { x: 0, y: 0 },
          description: '要执行鼠标操作的位置',
          quickConfig: true
        },
        customButton: {
          id: 'customButton',
          name: '操作按钮',
          type: 'radio',
          options: [
            { label: '左键', value: 'left' },
            { label: '中键', value: 'middle' },
            { label: '右键', value: 'right' }
          ],
          default: 'left',
          description: '自定义鼠标按钮',
          quickConfig: true,
          show:"${type} === 'custom'"
        },
        customAction: {
          id: 'customAction',
          name: '操作类型',
          type: 'radio',
          options: [
            { label: '按下', value: 'down' },
            { label: '释放', value: 'up' },
            { label: '点击', value: 'click' }
          ],
          default: '',
          description: '自定义鼠标操作',
          quickConfig: true,
          show:"${type} === 'custom'"
        },
        customClickCount:{
          id: 'customClickCount',
          name: '点击次数',
          type: 'number',
          default: 1,
          description: '自定义鼠标点击次数',
          quickConfig: true,
          show:"${customAction} === 'click'"
        },
        customClickDelay:{
          id: 'customClickDelay',
          name: '点击延迟',
          type: 'number',
          default: 10,
          description: '自定义鼠标点击延迟时间（毫秒）',
          quickConfig: true,
          show:"${customAction} === 'click'"
        },
        wheelDirection: {
          id: 'wheelDirection',
          name: '滚轮方向',
          type: 'radio',
          options: [
            { label: '上', value: 'up' },
            { label: '下', value: 'down' }
          ],
          default: 'up',
          description: '选择滚轮滚动方向',
          quickConfig: true,
          show:"${type} === 'wheel'"
        },
        wheelDelta: {
          id: 'wheelDelta',
          name: '滚动量',
          type: 'number',
          default: 150,
          description: '滚轮滚动的量',
          quickConfig: true,
          show:"${type} === 'wheel'"
        }
      }
    }
  },
  inputs: [],
  outputs: []
}
