/**
 * @file: 循环节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconBranch } from '@arco-design/web-vue/es/icon'

export default {
  type: 'workFlow',
  name: '工作流',
  icon: IconBranch,
  description: '工作流',
  view: true,
  subFlow: {
    name: '工作流',
    startOutputs: []
  },
  config: {},
  inputs: [],
  outputs: []
}
