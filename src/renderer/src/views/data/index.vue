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
    @refresh="fetchModels(true)"
    @edit="handleEdit"
    @category-change="onCategoryChange"
    @scroll="loadMore"
    @batch-delete="handleBatchDelete"
    @batch-export="handleBatchExport"
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
              <a-doption @click="handleExport(model)"><icon-export /> 导出</a-doption>
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
  <RecycleBin v-model:visible="showTrash" :api="dataAPI" :on-restored="() => fetchModels(true)" />

  <CopyCountModal v-model:visible="showCopyModal" name="数据表" @confirm="handleCopyConfirm" />
</template>

<script setup>
import { ref, onMounted, watch, onActivated } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconEdit, IconDelete, IconMoreVertical, IconSettings, IconCopy, IconExport } from '@arco-design/web-vue/es/icon'
import { RiDatabase2Line } from '@remixicon/vue'
import ResourceList from '@/components/ResourceList.vue'
import ModelEditor from './components/ModelEditor.vue'
import RecycleBin from '@/components/RecycleBin.vue'
import CopyCountModal from '@/components/CopyCountModal.vue'
import { useStore } from '@/store'
import { storeToRefs } from 'pinia'
import { exportToFile, batchExportToFile, importFromFile, MODULE_CONFIG } from '@/utils/importer'
import { debounce } from 'lodash-es'

const store = useStore()
const { openedTabs } = storeToRefs(store)
const { switchTab } = store
const { data: dataAPI } = window.electronAPI

const showTrash = ref(false)

const models = ref([])
const searchKeyword = ref('')
const showCreateModal = ref(false)
const editingModel = ref(null)
const selectedIds = ref([])
const showCopyModal = ref(false)
const copyTarget = ref(null)
const currentPage = ref(1)
const pageSize = 24
const loading = ref(false)
const hasMore = ref(true)
const categoryId = ref('')

const onCategoryChange = (val) => { categoryId.value = val; fetchModels(true) }
const loadMore = () => { currentPage.value++; fetchModels() }

const fetchModels = async (refresh = false) => {
  if (refresh) { currentPage.value = 1; hasMore.value = true }
  loading.value = true
  try {
    const result = await dataAPI.getModels({ page: currentPage.value, pageSize, keyword: searchKeyword.value, category_id: categoryId.value })
    if (result.data.length < pageSize) hasMore.value = false
    models.value = currentPage.value === 1 ? result.data : [...models.value, ...result.data]
  } catch (error) { Message.error('获取数据表失败') } finally { loading.value = false }
}

const handleEdit = (model) => { editingModel.value = model?.id ? model : {}; showCreateModal.value = true }

const handleEditorSuccess = () => {
  showCreateModal.value = false
  fetchModels(true)
}

const handleDelete = async (model, index) => {
  Modal.confirm({
    title: '删除确认', content: `确认删除 "${model.name}" 吗？`,
    okText: '删除', okButtonProps: { status: 'danger', type: 'primary', style: { width: '160px' } },
    cancelButtonProps: { style: { width: '160px' } },
    async onOk() {
      await dataAPI.deleteModel(model.id)
      Message.success('删除成功')
      models.value.splice(index, 1)
    }
  })
}

const handleViewData = (model) => {
  if (!openedTabs.value[model.id]) openedTabs.value[model.id] = { id: model.id, type: 'dataViewer', name: model.name, model }
  switchTab(model.id)
}

const handleCopy = (model) => { copyTarget.value = model; showCopyModal.value = true }

const handleCopyConfirm = async (count) => {
  const model = copyTarget.value
  try {
    for (let i = 1; i <= count; i++) {
      const suffix = count > 1 ? ` - 副本${i}` : ' - 副本'
      await dataAPI.copyModel(model.id, `${model.name}${suffix}`)
    }
    Message.success(`已复制 ${count} 份`); fetchModels(true)
  } catch (e) { Message.error('复制失败: ' + e.message) }
}

// 批量移入回收站
const handleBatchDelete = async (ids) => {
  try {
    await Promise.all(ids.map((id) => dataAPI.deleteModel(id)))
    Message.success(`已移入回收站 ${ids.length} 项`)
  } catch (e) { Message.error('批量删除失败') }
  selectedIds.value = []
  fetchModels(true)
}

const buildModelPayload = (modelData) => ({
  name: modelData.name,
  description: modelData.description,
  fields: JSON.parse(modelData.fields)
})

const handleExport = async (model) => {
  const modelData = await dataAPI.getModel(model.id)
  await exportToFile(async () => buildModelPayload(modelData), MODULE_CONFIG.model, { data: [] })
}

const handleBatchExport = async (ids) => {
  const modelDataList = await Promise.all(ids.map((id) => dataAPI.getModel(id)))
  await batchExportToFile(async () => modelDataList.map(buildModelPayload), MODULE_CONFIG.model)
}

const handleImport = () => {
  importFromFile(() => fetchModels(true))
}

watch(searchKeyword, debounce(() => { currentPage.value = 1; fetchModels(true) }, 300))
onMounted(() => fetchModels(true))
onActivated(() => fetchModels(true))
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
