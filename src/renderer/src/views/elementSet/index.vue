<template>
  <ResourceList
    type="elementSet"
    create-label="新建元素集"
    search-placeholder="搜索元素集"
    empty-text="暂无元素集"
    v-model:search-keyword="searchKeyword"
    :items="elementSets"
    :loading="loading"
    :has-more="hasMore"
    @create="handleCreate"
    @import="handleImport"
    @refresh="fetchElementSets(true)"
    @edit="handleEdit"
    @category-change="onCategoryChange"
    @scroll="loadMore"
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
                <a-doption @click="handleExport(es)"><icon-export /> 导出</a-doption>
                <a-doption @click="handleDelete(es, index)"><icon-delete /> 删除</a-doption>
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

  <RecycleBin v-model:visible="showTrash" :api="elementSetAPI" :on-restored="() => fetchElementSets(true)" />
</template>

<script setup>
import { ref, watch, onActivated } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconEdit, IconDelete, IconMoreVertical, IconExport } from '@arco-design/web-vue/es/icon'
import { RiStackLine } from '@remixicon/vue'
import ResourceList from '@/components/ResourceList.vue'
import RecycleBin from '@/components/RecycleBin.vue'
import ElementSetEditor from './components/ElementSetEditor.vue'
import { debounce } from 'lodash-es'
import { exportToFile, importFromFile, MODULE_CONFIG } from '@/utils/importer'

const { elementSet: elementSetAPI } = window.electronAPI
const showTrash = ref(false)

const elementSets = ref([])
const searchKeyword = ref('')
const showEditor = ref(false)
const selectedId = ref(null)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 24
const hasMore = ref(true)
const categoryId = ref('')

const onCategoryChange = (val) => { categoryId.value = val; fetchElementSets(true) }
const loadMore = () => { currentPage.value++; fetchElementSets() }

const fetchElementSets = async (refresh = false) => {
  if (refresh) { currentPage.value = 1; hasMore.value = true }
  loading.value = true
  try {
    const result = await elementSetAPI.getElementSets({
      page: currentPage.value, pageSize,
      keyword: searchKeyword.value,
      category_id: categoryId.value
    })
    if (result.data.length < pageSize) hasMore.value = false
    // 预取元素数量（并行，避免 24×RTT 串行往返）
    await Promise.all(
      result.data.map(async (es) => {
        const full = await elementSetAPI.getElementSet(es.id)
        es.elementCount = full?.elements?.length ?? 0
      })
    )
    elementSets.value = currentPage.value === 1 ? result.data : [...elementSets.value, ...result.data]
  } catch (e) { Message.error('获取元素集列表失败') } finally { loading.value = false }
}

const handleCreate = () => { selectedId.value = null; showEditor.value = true }
const handleEdit = (es) => { selectedId.value = es.id; showEditor.value = true }

const handleEditorSuccess = () => {
  showEditor.value = false
  fetchElementSets(true)
}

const handleDelete = (es, index) => {
  Modal.confirm({
    title: '删除确认',
    content: `确认删除"${es.title}"吗？`,
    okText: '删除',
    okButtonProps: { status: 'danger', type: 'primary', style: { width: '160px' } },
    cancelButtonProps: { style: { width: '160px' } },
    onOk: async () => {
      await elementSetAPI.deleteElementSet(es.id)
      elementSets.value.splice(index, 1)
    }
  })
}

const handleExport = async (es) => {
  const full = await elementSetAPI.getElementSet(es.id)
  await exportToFile(
    async () => ({
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
    }),
    MODULE_CONFIG.elementSet
  )
}

const handleImport = () => {
  importFromFile(() => fetchElementSets(true))
}

watch(searchKeyword, debounce(() => { currentPage.value = 1; fetchElementSets(true) }, 300))
onActivated(() => fetchElementSets(true))
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
