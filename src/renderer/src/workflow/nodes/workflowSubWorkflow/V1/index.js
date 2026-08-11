/**
 * @file: 子流程节点
 */
import { RiFlowChart } from "@remixicon/vue";

export default {
  type: 'workflowSubWorkflow',
  name: '子流程',
  icon: RiFlowChart,
  description: '创建一个子流程，用于逻辑封装，使用开始、结束节点输入、输出数据',
  view: true,
  subFlow: {
    name: '子流程',
    startOutputs: []
  },
  config: {},
  inputs: [],
  outputs: []
}
