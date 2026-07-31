/**
 * @file: 工作流重启节点
 * @author: dabao
 * @date: 2024-03-29
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
  description: '重新执行当前流程',
  // 节点视图
  view: true,
  // 允许前置节点连接点
  prev: true,
  // 允许后续节点连接点
  next: false,
  // 配置项
  config: {
  },
  inputs: [],
  outputs: []
}
