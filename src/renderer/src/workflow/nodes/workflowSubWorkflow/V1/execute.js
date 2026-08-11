/**
 * @file: 子流程节点执行器
 *
 * 与 workFlow（工作流）执行器逻辑完全一致：都经 executeSubFlow 分发到子流程
 * （子节点按 parentNode === '{id}-subFlow' 关联，见 WorkflowExecutor.executeSubFlow）。
 * 统一复用 workFlow 实现，避免双份代码漂移；dev/prod 布局相对路径一致。
 */
export { default } from '../../workFlow/V1/execute.js'
