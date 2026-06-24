/**
 * @file: 清零计数器节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconEmpty } from '@arco-design/web-vue/es/icon'

export default {
  type: 'counterClear',
  name: '清零计数器',
  icon: IconEmpty,
  description: '清零计数器',
  view: false,
  config: {},
  inputs: [
    {
      id: 'counter',
      name: '计数器',
      type: 'counter',
      description: '用于清零计数器',
      required: true
    }
  ],
  outputs: []
}
