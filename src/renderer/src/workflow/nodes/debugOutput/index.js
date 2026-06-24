/**
 * @file: 调试输出节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconBug } from '@arco-design/web-vue/es/icon'

export default {
  type: 'debugOutput',
  name: '调试输出',
  icon: IconBug,
  description: '调试数据输出',
  view: true,
  resizable:true,
  size: {
    width: 300,
    height: 200
  },
  config: {},
  inputs: [
    {
      id: 'data',
      name: '数据',
      type: ['object', 'array', 'string', 'number', 'boolean'],
      description: '要调试输出的数据',
      required: true
    }
  ],
  outputs: []
}
