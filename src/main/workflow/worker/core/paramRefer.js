/**
 * worker 端参数引用工具 —— 单一来源复用渲染端实现（内容完全一致，避免双份维护漂移）：
 *  - dev：经 import-map 的 @renderer/workflow/utils/paramRefer.js 映射到渲染端源码
 *  - prod：由 scripts/build-worker.mjs 复制为 resources/worker/param-refer.js 并改写映射
 */
export * from '@renderer/workflow/utils/paramRefer.js'
