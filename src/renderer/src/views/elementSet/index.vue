<template>
  <ResourceList
    type="elementSet"
    create-label="新建元素集"
    search-placeholder="搜索元素集"
    empty-text="暂无元素集"
    v-model:search-keyword="searchKeyword"
    v-model:selected-ids="selectedIds"
    :items="elementSets"
    :loading="loading"
    :has-more="hasMore"
    @create="handleCreate"
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
    <template #card="{ item: es, index }">
      <a-card class="element-set-card" :bordered="true" hoverable>
        <template #title>
          <div class="element-set-header">
            <div class="element-set-icon"><ri-stack-line /></div>
            <a-typography-text :ellipsis="{ showTooltip: true }" :style="{ margin: '0', width: '100%' }">{{ es.title }}</a-typography-text>
          </div>
        </template>
        <template #extra>
          <a-space>
            <a-dropdown>
              <a-button style="padding: 0 0px" type="text"><icon-more-vertical /></a-button>
              <template #content>
                <a-doption @click="handleEdit(es)"><icon-edit /> 编辑</a-doption>
                <a-doption @click="handleCopy(es)"><icon-copy /> 复制</a-doption>
                <a-doption @click="handleDelete(es, index)"><icon-delete /> 删除</a-doption>
                <a-doption @click="exportElementSet(es)"><icon-export /> 导出</a-doption>
              </template>
            </a-dropdown>
          </a-space>
        </template>
        <div class="element-set-content">
          <p class="description">{{ es.description || '暂无描述' }}</p>
        </div>
        <div class="element-set-info">
          <a-space>
            <a-tag size="large">{{ es.elementCount ?? 0 }}个元素</a-tag>
          </a-space>
        </div>
      </a-card>
    </template>
  </ResourceList>

  <ElementSetEditor
    v-model:visible="showEditor"
    :model-id="selectedId"
    @success="handleEditorSuccess"
  />

  <RecycleBin v-model:visible="showTrash" :api="elementSetAPI" :on-restored="refetch" />

  <CopyCountModal v-model:visible="showCopyModal" name="元素集" @confirm="(count) => handleCopyConfirm(count, copyElementSet)" />
</template>

<script setup>
import { ref } from 'vue'
import { IconEdit, IconDelete, IconMoreVertical, IconExport, IconCopy } from '@arco-design/web-vue/es/icon'
import { RiStackLine } from '@remixicon/vue'
import ResourceList from '@/components/ResourceList.vue'
import RecycleBin from '@/components/RecycleBin.vue'
import ElementSetEditor from './components/ElementSetEditor.vue'
import CopyCountModal from '@/components/CopyCountModal.vue'
import { MODULE_CONFIG } from '@/utils/importer'
import { useResourceList } from '@/composables/useResourceList'

const { elementSet: elementSetAPI } = window.electronAPI
const showTrash = ref(false)
const showEditor = ref(false)
const selectedId = ref(null)

const {
  items: elementSets,
  searchKeyword, selectedIds, loading, hasMore, showCopyModal,
  onCategoryChange, loadMore, refetch,
  handleCopy, handleCopyConfirm,
  confirmDelete, handleBatchDelete,
  handleExport, handleBatchExport, handleImport
} = useResourceList({
  api: {
    list: (params) => elementSetAPI.getElementSets(params),
    get: (id) => elementSetAPI.getElementSet(id),
    remove: (id) => elementSetAPI.deleteElementSet(id)
  },
  moduleConfig: MODULE_CONFIG.elementSet,
  listErrorMsg: '获取元素集列表失败'
})

const handleCreate = () => { selectedId.value = null; showEditor.value = true }
const handleEdit = (es) => { selectedId.value = es.id; showEditor.value = true }

const handleEditorSuccess = () => {
  showEditor.value = false
  refetch()
}

const handleDelete = (es, index) => {
  confirmDelete(es, (e) => e.title, async () => {
    await elementSetAPI.deleteElementSet(es.id)
    elementSets.value.splice(index, 1)
  })
}

const copyElementSet = async (es, suffix) => {
  const full = await elementSetAPI.getElementSet(es.id)
  await elementSetAPI.createElementSet({
    title: `${full.title}${suffix}`,
    description: full.description,
    category_id: full.category_id,
    elements: full.elements || []
  })
}

const batchDelete = (ids) => handleBatchDelete(ids, (id) => elementSetAPI.deleteElementSet(id))

const buildElementSetPayload = (full) => ({
  title: full.title,
  description: full.description,
  category_id: full.category_id,
  elements: (full.elements || []).map((el) => ({
    name: el.name,
    match_condition: el.match_condition,
    selectors: (el.selectors || []).map((sel) => ({
      type: sel.type,
      text_subtype: sel.text_subtype,
      expression: sel.expression
    }))
  }))
})

const exportElementSet = (es) => handleExport(es, buildElementSetPayload)
const batchExport = (ids) => handleBatchExport(ids, buildElementSetPayload)
</script>

<style lang="less" scoped>
.element-set-card {
  margin-bottom: 16px; transition: all 0.3s;
  &:hover { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,.09); }
  :deep(.arco-card-header) { border: none !important; }
}
.element-set-header { display: flex; align-items: center; font-size: 18px; font-weight: bold; .element-set-icon { margin-right: 12px; } }
.element-set-content .description { color: var(--color-text-3); height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size: 13px; }
.element-set-info { display: flex; justify-content: flex-end; margin-top: 12px; align-items: center; }
</style>
