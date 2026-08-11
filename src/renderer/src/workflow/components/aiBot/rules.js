/**
 * @file: 客户端工作流硬性规定（从代码提取，供 AI system prompt 使用）
 * 这些规则由 FreeRPA 执行引擎/画布强制约束，AI 必须遵守，违反会直接报错或产生非法工作流。
 * 来源依据（代码位置见各条注释）：
 * - 流程边界：nodes/index.js（categories）、workflow.js addNode（workflowEnd 查重）、utils/connectionRules.js
 * - 终止语义：main/workflow/host 引擎状态机（stopWorkflow → stopped；无 end 自然 completed）
 * - 子流程：nodes/index.js（subFlow 容器 + 起始节点）、engine/validate.js（subflow-structure 检测）
 */

/** 硬性规定（数组，每项一条，供 system prompt 拼接；保持精简可读） */
export const HARD_RULES = [
  '【流程边界】每个流程（主流程或子流程）必须有且只有一个开始节点 workflowStart 和一个结束节点 workflowEnd：'
    + 'workflowStart 由系统自动创建且不可删除、无前置连线；workflowEnd 同一流程内禁止重复添加（已存在时 addNode 会拒绝）。',
  '【终止语义】流程执行到 workflowEnd 即停止（状态 stopped）；若没有 workflowEnd，执行到无后续节点时自然结束（状态 completed）。'
    + '监听/持续运行类节点（浏览器监听、网络监听等）会保持运行，必须为其所在流程添加 workflowEnd 或在运行中手动停止，否则流程不会自行结束。',
  '【执行中锁定】工作流正在执行（running）时禁止添加/删除节点，相关操作会被拒绝，需等待执行结束。',
  '【子流程】子流程容器节点（如循环 workflowLoop）创建时自动附带子流程画布与内部开始节点，无需也无法手动添加容器内开始节点；'
    + '给子流程内添加节点时，新增节点会随被连接前驱自动归属到同一子流程。',
  '【连线规则】只能连接同一流程（主流程或同一子流程）内的节点，跨流程连线非法；连接时端口按类型自动匹配，无需指定端口。',
  '【参数引用】需要引用上游节点输出时，配置字段值直接写 {{节点名称.输出名称}}（如 {{数据提取.items}}）；'
    + '数组/复杂字段整体引用时同样直接写引用串，不要用 JSON 字符串、数组括号包裹或自造分隔符。',
  '【同名去重】同一流程内节点名称重复时，系统会自动追加序号（如 循环_2），AI 创建节点时无需自行处理重名。',
  '【类型合法性】节点 type 必须来自节点类型目录（内置节点或 plu_ 插件节点），不存在的 type 会被拒绝。',
  '【必填约束】required 的输入端口必须连接到上游节点；required 的配置字段必须填写有效值，否则工作流无法运行。'
]

/** 工作流操作规则（工具使用方式，与工具定义对应） */
export const OPERATION_RULES = [
  '创建节点用 addNode（type 从节点类型目录中选），用 connectTo 指定要连接的前驱节点ID，工具会自动按端口类型规则连线；'
    + '连接两个已有节点用 connect（只需 source/target 节点ID）。',
  '填写节点配置前，先调用 getNodeConfig 查询该类型的配置说明（默认返回精简概览，传 detail=true 获取完整字段说明），再按字段填 addNode/updateNode 的 config。',
  '修改节点配置/名称用 updateNode；删除节点用 deleteNode（危险操作会弹确认框）；删除连线用 deleteEdge。',
  '创建数据表/浏览器/元素集等资源前先查询是否已存在可复用的（listTables/getMajorVersionList/listElementSets），避免重复创建；'
    + '枚举选项（如表 ID、内核版本）以查询返回值为准，不要臆造。'
]
