# 节点定义目录

每个节点一个子目录（`{nodeType}/V{version}/`），含：
- `index.js` — 节点定义（名称/图标/config 分组/inputs/outputs，经 `nodes/index.js` 自动发现注册）
- `execute.js` — 节点执行器（worker 端运行时加载；构建时复制到 `resources/worker/nodes/`）
- `view.vue` — 节点专属画布视图（`view: true` 的节点必需）

共享 UI 组件不在此目录，请放 `workflow/components/nodes/`（见该目录 README）。
