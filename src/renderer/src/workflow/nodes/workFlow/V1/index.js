/**
 * @file: 循环节点
 */
import { IconBranch } from '@arco-design/web-vue/es/icon'

export default {
  type: 'workFlow',
  name: '工作流',
  icon: IconBranch,
  description: '工作流容器节点，代表一个完整的工作流，是所有流程节点的顶层宿主。一个流程有且仅有一个：流程从“开始流程”节点启动、在“结束流程”节点终止，其中可容纳任意业务节点构成完整流程。',
  view: true,
  subFlow: {
    name: '工作流',
    startOutputs: []
  },
  config: [],
  inputs: [],
  outputs: []
}
