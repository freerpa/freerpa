/**
 * @file: 子流程节点
 */
import { RiFlowChart } from "@remixicon/vue";

export default {
  type: 'workflowSubWorkflow',
  name: '子流程',
  icon: RiFlowChart,
  description: '子流程节点：将一段独立画布封装为可复用子流程，通过内部的“开始流程/结束流程”节点接收输入参数并返回输出结果，用于逻辑分层与复用。',
  view: true,
  subFlow: {
    name: '子流程',
    startOutputs: []
  },
  config: [],
  inputs: [],
  outputs: []
}
