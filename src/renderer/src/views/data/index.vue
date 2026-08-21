<template>
  <ResourceList
    type="model"
    create-label="新建数据表"
    search-placeholder="搜索数据表"
    empty-text="暂无数据表"
    v-model:search-keyword="searchKeyword"
    v-model:selected-ids="selectedIds"
    :items="models"
    :loading="loading"
    :has-more="hasMore"
    @create="showCreateModal = true; editingModel = null"
    @import="handleImport"
    @refresh="refetch"
    @edit="handleEdit"
    @category-change="onCategoryChange"
    @scroll="loadMore"
    @batch-delete="batchDelete"
    @batch-export="batchExport"
  >
    <template #extra-actions>
      <a-button @click="showTrash = true"><template #icon><icon-delete /></template>回收站</a-button>
    </template>
    <template #card="{ item: model, index }">
      <a-card class="model-card" :bordered="true" hoverable>
        <template #title>
          <div class="model-header">
            <div class="model-icon"><ri-database2-line /></div>
            <a-typography-text :ellipsis="{ showTooltip: true }" :style="{ margin: '0', width: '100%' }">
              {{ model.name }}
            </a-typography-text>
          </div>
        </template>
        <template #extra>
          <a-dropdown>
            <a-button style="padding: 0 0px" type="text"><icon-more-vertical /></a-button>
            <template #content>
              <a-doption @click="handleEdit(model)"><icon-edit /> 编辑</a-doption>
              <a-doption @click="handleCopy(model)"><icon-copy /> 复制</a-doption>
              <a-doption @click="handleDelete(model, index)"><icon-delete /> 删除</a-doption>
              <a-doption @click="exportModel(model)"><icon-export /> 导出</a-doption>
            </template>
          </a-dropdown>
        </template>
        <div class="model-content">
          <p class="description">{{ model.description || '暂无描述' }}</p>
        </div>
        <div class="model-info">
          <div class="model-stats">
            <div class="stat-item"><icon-settings /> {{ model.field_stats?.total || 0 }} 个字段</div>
            <div class="stat-item"><ri-database2-line /> {{ model.data_count || 0 }} 条数据</div>
          </div>
          <a-button type="primary" @click="handleViewData(model)">
            <template #icon><ri-database2-line /></template>
            打开数据表
          </a-button>
        </div>
      </a-card>
    </template>
  </ResourceList>

  <ModelEditor
    v-model:visible="showCreateModal"
    :model-id="editingModel?.id"
    @success="handleEditorSuccess"
  />
  <RecycleBin v-model:visible="showTrash" :api="dataAPI" :on-restored="refetch" />

  <CopyCountModal v-model:visible="showCopyModal" name="数据表" @confirm="(count) => handleCopyConfirm(count, copyModel)" />
</template>

<script setup>
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconEdit, IconDelete, IconMoreVertical, IconSettings, IconCopy, IconExport } from '@arco-design/web-vue/es/icon'
import { RiDatabase2Line } from '@remixicon/vue'
import ResourceList from '@/components/ResourceList.vue'
import ModelEditor from './components/ModelEditor.vue'
import RecycleBin from '@/components/RecycleBin.vue'
import CopyCountModal from '@/components/CopyCountModal.vue'
import { useStore } from '@/store'
import { storeToRefs } from 'pinia'
import { MODULE_CONFIG } from '@/utils/importer'
import { useResourceList } from '@/composables/useResourceList'

const store = useStore()
const { openedTabs } = storeToRefs(store)
const { switchTab } = store
const { data: dataAPI } = window.electronAPI

const showTrash = ref(false)
const showCreateModal = ref(false)
const editingModel = ref(null)

const {
  items: models,
  searchKeyword, selectedIds, loading, hasMore, showCopyModal,
  onCategoryChange, loadMore, refetch,
  handleCopy, handleCopyConfirm,
  confirmDelete, handleBatchDelete,
  handleExport, handleBatchExport, handleImport
} = useResourceList({
  api: {
    list: (params) => dataAPI.getModels(params),
    get: (id) => dataAPI.getModel(id),
    remove: (id) => dataAPI.deleteModel(id)
  },
  moduleConfig: MODULE_CONFIG.model,
  listErrorMsg: '获取数据表失败'
})

const handleEdit = (model) => { editingModel.value = model?.id ? model : {}; showCreateModal.value = true }

const handleEditorSuccess = () => {
  showCreateModal.value = false
  refetch()
}

const handleDelete = (model, index) => {
  confirmDelete(model, (m) => m.name, async () => {
    await dataAPI.deleteModel(model.id)
    Message.success('删除成功')
    models.value.splice(index, 1)
  })
}

const handleViewData = (model) => {
  if (!openedTabs.value[model.id]) openedTabs.value[model.id] = { id: model.id, type: 'dataViewer', name: model.name, model }
  switchTab(model.id)
}

const copyModel = (model, suffix) => dataAPI.copyModel(model.id, `${model.name}${suffix}`)

const buildModelPayload = (modelData) => ({
  name: modelData.name,
  description: modelData.description,
  fields: JSON.parse(modelData.fields)
})

const exportModel = (model) => handleExport(model, buildModelPayload)
const batchExport = (ids) => handleBatchExport(ids, buildModelPayload)
const batchDelete = (ids) => handleBatchDelete(ids, (id) => dataAPI.deleteModel(id))
</script>

<style lang="less" scoped>
.model-card {
  margin-bottom: 16px;
  transition: all 0.3s;
  &:hover { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09); }
  :deep(.arco-card-header) { border: none !important; }
}
.model-header { display: flex; align-items: center; font-size: 18px; font-weight: bold; .model-icon { margin-right: 12px; } }
.model-content .description { color: var(--color-text-3); height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size: 13px; line-height: 1.6; }
.model-info { display: flex; justify-content: space-between; color: var(--color-text-3); font-size: 12px; margin-top: 12px; align-items: center; }
.model-stats { display: flex; gap: 16px; }
.stat-item { display: flex; align-items: center; gap: 4px; color: var(--color-text-2); font-size: 13px; }
</style>
