/**
 * @file: 工作流重启节点
 */
import { RiRestartLine } from '@remixicon/vue'
export default {
  // 节点名称
  name: '重启流程',
  // 节点类型
  type: 'workflowRestart',
  // 节点图标
  icon: RiRestartLine,
  // 节点描述
  description: '重启流程节点：触发后立即丢弃当前执行进度，从“开始流程”节点重新执行整个工作流（相当于重新运行一次）。',
  // 节点视图
  view: true,
  // 允许前置节点连接点
  prev: true,
  // 允许后续节点连接点
  next: false,
  // 配置项
  config: [],
  inputs: [],
  outputs: []
}
