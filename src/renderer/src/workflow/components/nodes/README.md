# 共享节点视图组件

本目录存放**被多个节点 view.vue 复用的通用视图组件**（如 FormView 表单渲染器、dataHandlerView 数据处理视图），与「节点定义目录」不同：

- 本目录（`workflow/components/nodes/`）：共享 UI 组件，由各节点的 `view.vue` 通过 `@/workflow/components/nodes/*` 引用
- `workflow/nodes/`（节点定义目录）：每个节点一个子目录，含 `index.js`（节点定义）/ `execute.js`（执行器）/ `view.vue`（节点专属视图）

注意区分，避免把共享组件错放进节点定义目录。
