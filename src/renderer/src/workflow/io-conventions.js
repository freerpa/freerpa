/**
 * 动态 IO 约定的标准字段键与常用 fieldMap 模板
 * 渲染端（useNodeIO/resolveDynamicIO）与 worker 端（build-worker 复制后）共用，
 * 消除各节点 index.js 里 fieldMap 键拼写漂移（'name'/'id'/'field'、'type'/'dataType'）
 */
export const IO_KEY = {
  ID: 'id',
  NAME: 'name',
  DESCRIPTION: 'description',
  TYPE: 'type',
  REQUIRED: 'required',
  // fieldMap.isConfig 是布尔标记（该动态输出整体带 isConfig），而非数据模型字段名
  IS_CONFIG: 'isConfig'
}

/** 标准 fieldMap：数据模型字段名即标准键（id 字段名是 'id'） */
export const IO_FIELD_MAP_STANDARD = {
  id: IO_KEY.ID,
  name: IO_KEY.NAME,
  description: IO_KEY.DESCRIPTION,
  type: IO_KEY.TYPE,
  required: IO_KEY.REQUIRED
}

/** name 作 id 的变体（workflowStart/End/CustomNode/timeSchedule/dataCreate 的 params 类数据模型） */
export const IO_FIELD_MAP_NAME_ID = {
  ...IO_FIELD_MAP_STANDARD,
  id: IO_KEY.NAME
}
