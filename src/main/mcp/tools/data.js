/**
 * @file: MCP 数据工具（数据模型 / 数据记录 / 元素集 / 分类）
 * 与客户端「数据库」页面能力一致：模型定义、记录 CRUD、回收站、元素集。
 */
import {
  getModel,
  getModels,
  createModel,
  updateModel,
  deleteModel,
  copyModel,
  getTrashModels,
  restoreModel,
  permanentDeleteModel,
  getModelData,
  createModelData,
  updateModelData,
  deleteModelData,
  clearModelData,
  batchCreateModelData,
} from '../../data/models/index.js';
import {
  getElementSets,
  getElementSet,
  createElementSet,
  updateElementSet,
  deleteElementSet,
  restoreElementSet,
  getTrashElementSets,
  permanentDeleteElementSet,
} from '../../data/elementSets/index.js';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../../data/categories/index.js';
import { defineTool } from '../registry.js';

const fieldSchema = {
  type: 'object',
  description: '字段定义：{ id, name, type, required, unique, default, ... }',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string', description: '字段类型，如 text/number/date/boolean/select' },
    required: { type: 'boolean' },
    unique: { type: 'boolean' },
    default: {},
  },
  required: ['name', 'type'],
  additionalProperties: true,
};

const elementSchema = {
  type: 'object',
  description: '元素：{ name, match_condition, selectors: [{ type, text_subtype, expression }] }',
  properties: {
    name: { type: 'string' },
    match_condition: { type: 'string', description: 'any / all' },
    selectors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          text_subtype: { type: 'string' },
          expression: { type: 'string' },
        },
      },
    },
  },
  required: ['name'],
  additionalProperties: true,
};

export const registerDataTools = () => {
  // ─── 数据模型 ─────────────────────────────────────────

  defineTool({
    name: 'data_model_list',
    title: '数据模型列表',
    description: '分页查询数据模型（不含回收站），返回字段统计与记录数。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
      },
    },
    annotations: { readOnlyHint: true },
    handler: async ({ keyword = '', page = 1, pageSize = 20 }) => getModels({ keyword, page, pageSize }),
  });

  defineTool({
    name: 'data_model_get',
    title: '数据模型详情',
    description: '按 id 获取数据模型定义（fields 为字段数组）。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ id }) => {
      const model = await getModel(id);
      if (!model) throw new Error(`数据模型不存在：${id}`);
      return { ...model, fields: JSON.parse(model.fields || '[]') };
    },
  });

  defineTool({
    name: 'data_model_create',
    title: '创建数据模型',
    description: '创建数据模型（即数据库表）。fields 为字段定义数组，创建后表结构随之生成。返回模型 id。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        category_id: { type: 'string' },
        fields: { type: 'array', items: fieldSchema },
      },
      required: ['name', 'fields'],
    },
    handler: async ({ name, description = '', category_id = '', fields }) => {
      const id = await createModel({ name, description, category_id, fields });
      return { id, name };
    },
  });

  defineTool({
    name: 'data_model_update',
    title: '更新数据模型',
    description: '更新模型名称/描述/字段。⚠ 修改字段会触发表结构变更，建议先 data_model_get 取出完整 fields 再改。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        category_id: { type: 'string' },
        fields: { type: 'array', items: fieldSchema },
      },
      required: ['id'],
    },
    handler: async ({ id, name, description, category_id, fields }) => {
      const model = await getModel(id);
      if (!model) throw new Error(`数据模型不存在：${id}`);
      await updateModel({
        id,
        name: name ?? model.name,
        description: description ?? model.description,
        category_id: category_id ?? model.category_id,
        fields: fields ?? JSON.parse(model.fields || '[]'),
      });
      return { success: true, id };
    },
  });

  defineTool({
    name: 'data_model_delete',
    title: '删除数据模型（移入回收站）',
    description: '软删除数据模型（数据表保留，可从回收站恢复）。需 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['id', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ id }) => {
      await deleteModel(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'data_model_restore',
    title: '恢复数据模型',
    description: '从回收站恢复数据模型。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      await restoreModel(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'data_model_permanent_delete',
    title: '彻底删除数据模型',
    description: '从回收站彻底删除模型及其数据表，不可恢复。需 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['id', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ id }) => {
      await permanentDeleteModel(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'data_model_trash_list',
    title: '回收站数据模型',
    description: '列出回收站中的数据模型。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => getTrashModels(),
  });

  defineTool({
    name: 'data_model_copy',
    title: '复制数据模型',
    description: '复制模型结构（不复制数据）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string', description: '副本名称（留空自动命名）' },
      },
      required: ['id'],
    },
    handler: async ({ id, name }) => {
      const newId = await copyModel(id, name);
      return { id: newId };
    },
  });

  // ─── 数据记录 ─────────────────────────────────────────

  defineTool({
    name: 'data_record_query',
    title: '查询数据记录',
    description:
      '分页查询某个模型的数据记录。filters 为等值过滤（{字段: 值}），conditions 为自定义条件数组，sort 为排序（如 { field, order: "asc|desc" }）。',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 500, default: 20 },
        filters: { type: 'object', additionalProperties: true },
        conditions: { type: 'array', items: { type: 'object', additionalProperties: true } },
        sort: { type: 'object', additionalProperties: true },
        readFields: { type: 'array', items: { type: 'string' }, description: '只返回指定字段' },
      },
      required: ['modelId'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({
      modelId,
      page = 1,
      pageSize = 20,
      filters = {},
      conditions = [],
      sort = null,
      readFields = [],
    }) => getModelData({ modelId, page, pageSize, filters, conditions, sort, readFields }),
  });

  defineTool({
    name: 'data_record_create',
    title: '新增数据记录',
    description: '向指定模型插入一条记录（data 为字段值对象）。',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        data: { type: 'object', additionalProperties: true },
      },
      required: ['modelId', 'data'],
    },
    handler: async ({ modelId, data }) => {
      const result = await createModelData({ modelId, data });
      return { success: true, result };
    },
  });

  defineTool({
    name: 'data_record_update',
    title: '更新数据记录',
    description: '按记录 id 批量更新字段值（ids 为记录 id 数组）。',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        ids: { type: 'array', items: { type: 'string' } },
        data: { type: 'object', additionalProperties: true },
      },
      required: ['modelId', 'ids', 'data'],
    },
    handler: async ({ modelId, ids, data }) => {
      const result = await updateModelData({ modelId, ids, data });
      return { success: true, result };
    },
  });

  defineTool({
    name: 'data_record_delete',
    title: '删除数据记录',
    description: '按记录 id 删除数据（不可恢复）。需 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        ids: { type: 'array', items: { type: 'string' } },
        confirm: { type: 'boolean' },
      },
      required: ['modelId', 'ids', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ modelId, ids }) => {
      const result = await deleteModelData({ modelId, ids });
      return { success: true, result };
    },
  });

  defineTool({
    name: 'data_record_clear',
    title: '清空数据记录',
    description: '清空模型全部记录（保留表结构，不可恢复）。需 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: { modelId: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['modelId', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ modelId }) => {
      const result = await clearModelData({ modelId });
      return { success: true, result };
    },
  });

  defineTool({
    name: 'data_record_batch_create',
    title: '批量新增数据记录',
    description: '批量插入记录（data 为记录数组），内部按批次写入。',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        data: { type: 'array', items: { type: 'object', additionalProperties: true } },
        batchSize: { type: 'integer', minimum: 1, maximum: 5000, default: 1000 },
      },
      required: ['modelId', 'data'],
    },
    handler: async ({ modelId, data, batchSize = 1000 }) => {
      const result = await batchCreateModelData({ modelId, data, batchSize });
      return { success: true, result };
    },
  });

  // ─── 元素集 ───────────────────────────────────────────

  defineTool({
    name: 'element_set_list',
    title: '元素集列表',
    description: '分页查询元素集（不含回收站），返回元素数量。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
      },
    },
    annotations: { readOnlyHint: true },
    handler: async ({ keyword = '', page = 1, pageSize = 20 }) => getElementSets({ keyword, page, pageSize }),
  });

  defineTool({
    name: 'element_set_get',
    title: '元素集详情',
    description: '按 id 获取元素集及其元素/选择器。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ id }) => {
      const set = await getElementSet(id);
      if (!set) throw new Error(`元素集不存在：${id}`);
      return set;
    },
  });

  defineTool({
    name: 'element_set_create',
    title: '创建元素集',
    description: '创建元素集及其元素（selectors 为选择器数组）。返回元素集 id。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        category_id: { type: 'string' },
        elements: { type: 'array', items: elementSchema },
      },
      required: ['title'],
    },
    handler: async ({ title, description = '', category_id = '', elements = [] }) => {
      const id = await createElementSet({ title, description, category_id, elements });
      return { id, title };
    },
  });

  defineTool({
    name: 'element_set_update',
    title: '更新元素集',
    description: '更新元素集；传入 elements 会整体替换元素与选择器。建议先 element_set_get 取出再改。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        category_id: { type: 'string' },
        elements: { type: 'array', items: elementSchema },
      },
      required: ['id'],
    },
    handler: async (payload) => {
      const set = await getElementSet(payload.id);
      if (!set) throw new Error(`元素集不存在：${payload.id}`);
      await updateElementSet(payload);
      return { success: true, id: payload.id };
    },
  });

  defineTool({
    name: 'element_set_delete',
    title: '删除元素集（移入回收站）',
    description: '软删除元素集，可恢复。需 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['id', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ id }) => {
      await deleteElementSet(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'element_set_restore',
    title: '恢复元素集',
    description: '从回收站恢复元素集。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      await restoreElementSet(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'element_set_permanent_delete',
    title: '彻底删除元素集',
    description: '从回收站彻底删除元素集及元素/选择器，不可恢复。需 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['id', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ id }) => {
      await permanentDeleteElementSet(id);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'element_set_trash_list',
    title: '回收站元素集',
    description: '列出回收站中的元素集。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: async () => getTrashElementSets(),
  });

  // ─── 分类 ─────────────────────────────────────────────

  defineTool({
    name: 'category_list',
    title: '分类列表',
    description: '按类型查询分类（type：workflow / browser / data / elementSet 等，具体取值与客户端一致）。',
    inputSchema: {
      type: 'object',
      properties: { type: { type: 'string' } },
      required: ['type'],
    },
    annotations: { readOnlyHint: true },
    handler: async ({ type }) => getCategories(type),
  });

  defineTool({
    name: 'category_create',
    title: '创建分类',
    description: '为指定类型创建分类。',
    inputSchema: {
      type: 'object',
      properties: { type: { type: 'string' }, name: { type: 'string' } },
      required: ['type', 'name'],
    },
    handler: async ({ type, name }) => {
      const id = await addCategory(type, name);
      return { id, type, name };
    },
  });

  defineTool({
    name: 'category_update',
    title: '重命名分类',
    description: '修改分类名称。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' } },
      required: ['id', 'name'],
    },
    handler: async ({ id, name }) => {
      await updateCategory(id, name);
      return { success: true, id };
    },
  });

  defineTool({
    name: 'category_delete',
    title: '删除分类',
    description: '删除分类（分类下的资源不会被删除，但会失去分类归属）。需 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['id', 'confirm'],
    },
    annotations: { destructiveHint: true },
    handler: async ({ id }) => {
      await deleteCategory(id);
      return { success: true, id };
    },
  });
};
