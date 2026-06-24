/**
 * @file: 子流程节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { RiFlowChart } from "@remixicon/vue";

export default {
  type: 'subWorkFlow',
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
