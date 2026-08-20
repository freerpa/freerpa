<template>
  <ResourceList
    type="workflow"
    create-label="新建工作流"
    search-placeholder="搜索工作流"
    empty-text="暂无工作流"
    v-model:search-keyword="searchKeyword"
    v-model:selected-ids="selectedIds"
    :items="workflows"
    :loading="loading"
    :has-more="hasMore"
    @create="handleCreate"
    @import="handleImport"
    @refresh="fetchWorkflows(true)"
    @edit="handleEdit"
    @category-change="onCategoryChange"
    @scroll="loadMore"
    @batch-delete="handleBatchDelete"
  >
    <template #extra-actions>
      <a-button @click="showTrash = true"><template #icon><icon-delete /></template>回收站</a-button>
    </template>
    <template #card="{ item: workflow, index }">
      <a-card class="workflow-card" :bordered="true" hoverable>
        <template #title>
          <div class="workflow-header">
            <div class="workflow-icon"><ri-flow-chart /></div>
            <a-typography-text :ellipsis="{ showTooltip: true }" :style="{ margin: '0', width: '100%' }">{{ workflow.name }}</a-typography-text>
          </div>
        </template>
        <template #extra>
          <a-space>
            <a-dropdown>
              <a-button style="padding: 0 0px" type="text"><icon-more-vertical /></a-button>
              <template #content>
                <a-doption @click="handleEdit(workflow)"><icon-edit /> 编辑</a-doption>
                <a-doption @click="handleCopy(workflow)"><icon-copy /> 复制</a-doption>
                <a-doption :disabled="getStatus(workflow.id) === 'running'" @click="handleDelete(workflow, index)"><icon-delete /> 删除</a-doption>
                <a-doption @click="handleExport(workflow)"><icon-export /> 导出</a-doption>
              </template>
            </a-dropdown>
          </a-space>
        </template>
        <div class="workflow-content"><p class="description">{{ workflow.description || '暂无描述' }}</p></div>
        <div class="workflow-info">
          <a-space>
            <a-tag color="red" size="large" v-if="getNoticeNum(workflow.id) > 0">{{ getNoticeNum(workflow.id) }}个通知</a-tag>
            <a-tag :color="getStatusColor(workflow.id)" size="large" :bordered="getStatus(workflow.id)==='running'" :loading="getStatus(workflow.id)==='running'">{{ getStatusText(workflow.id) }}</a-tag>
            <a-button type="primary" @click="handleViewWorkflow(workflow)"><template #icon><ri-flow-chart /></template>打开工作流</a-button>
          </a-space>
        </div>
      </a-card>
    </template>
  </ResourceList>

  <WorkflowInfoEditor v-model:visible="showWorkflowInfoEditor" :model-id="selectedWorkflow?.id" @success="handleEditorSuccess" />

  <CopyCountModal v-model:visible="showCopyModal" name="工作流" @confirm="handleCopyConfirm" />

  <RecycleBin v-model:visible="showTrash" :api="workflowAPI" :on-restored="() => fetchWorkflows(true)" />
</template>

<script setup>
import { ref, watch, onActivated } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconEdit, IconDelete, IconMoreVertical, IconCopy, IconExport } from '@arco-design/web-vue/es/icon'
import { RiFlowChart } from '@remixicon/vue'
import ResourceList from '@/components/ResourceList.vue'
import WorkflowInfoEditor from './components/WorkflowInfoEditor.vue'
import RecycleBin from '@/components/RecycleBin.vue'
import CopyCountModal from '@/components/CopyCountModal.vue'
import { useFlowStore } from '@/workflow/store'
import { useStore } from '@/store'
import { storeToRefs } from 'pinia'
import { debounce } from 'lodash-es'
import { exportToFile, importFromFile, MODULE_CONFIG } from '@/utils/importer'

const { workflow: workflowAPI } = window.electronAPI
const showTrash = ref(false)
const store = useStore()
const { openedTabs } = storeToRefs(store)

const workflows = ref([])
const searchKeyword = ref('')
const showWorkflowInfoEditor = ref(false)
const selectedWorkflow = ref(null)
const selectedIds = ref([])
const showCopyModal = ref(false)
const copyTarget = ref(null)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 24
const hasMore = ref(true)
const categoryId = ref('')

const onCategoryChange = (val) => { categoryId.value = val; fetchWorkflows(true) }
const loadMore = () => { currentPage.value++; fetchWorkflows() }

const fetchWorkflows = async (refresh = false) => {
  if (refresh) { currentPage.value = 1; hasMore.value = true }
  loading.value = true
  try {
    const result = await workflowAPI.getWorkflows({ page: currentPage.value, pageSize, keyword: searchKeyword.value, category_id: categoryId.value })
    if (result.data.length < pageSize) hasMore.value = false
    workflows.value = currentPage.value === 1 ? result.data : [...workflows.value, ...result.data]
  } catch (e) { Message.error('获取工作流列表失败') } finally { loading.value = false }
}

const handleCreate = () => { selectedWorkflow.value = null; showWorkflowInfoEditor.value = true }
const handleEdit = (workflow) => { selectedWorkflow.value = workflow; showWorkflowInfoEditor.value = true }

const handleEditorSuccess = (workflow) => {
  showWorkflowInfoEditor.value = false
  fetchWorkflows(true)
  if (!selectedWorkflow.value) handleViewWorkflow(workflow)
}

const handleDelete = (workflow, index) => {
  Modal.confirm({
    title: '删除确认', content: `确认删除"${workflow.name}"吗？`, okText: '删除',
    okButtonProps: { status: 'danger', type: 'primary', style: { width: '160px' } },
    cancelButtonProps: { style: { width: '160px' } },
    onOk: async () => { await workflowAPI.deleteWorkflow(workflow.id); workflows.value.splice(index, 1) }
  })
}

const handleCopy = (workflow) => { copyTarget.value = workflow; showCopyModal.value = true }

const handleCopyConfirm = async (count) => {
  const workflow = copyTarget.value
  try {
    const full = await workflowAPI.getWorkflow(workflow.id)
    for (let i = 1; i <= count; i++) {
      const suffix = count > 1 ? ` - 副本${i}` : ' - 副本'
      await workflowAPI.createWorkflow({ name: `${full.name}${suffix}`, description: full.description, category_id: full.category_id, graph: JSON.parse(full.graph) })
    }
    Message.success(`已复制 ${count} 份`); fetchWorkflows(true)
  } catch (e) { Message.error('复制失败') }
}

// 批量移入回收站（跳过执行中的工作流）
const handleBatchDelete = async (ids) => {
  const runningIds = ids.filter((id) => getStatus(id) === 'running')
  const deleteIds = ids.filter((id) => getStatus(id) !== 'running')
  if (runningIds.length) Message.warning(`跳过 ${runningIds.length} 个执行中的工作流`)
  try {
    await Promise.all(deleteIds.map((id) => workflowAPI.deleteWorkflow(id)))
    if (deleteIds.length) Message.success(`已移入回收站 ${deleteIds.length} 项`)
  } catch (e) { Message.error('批量删除失败') }
  selectedIds.value = []
  fetchWorkflows(true)
}

const handleExport = async (workflow) => {
  const full = await workflowAPI.getWorkflow(workflow.id)
  await exportToFile(
    async () => ({ name: full.name, description: full.description, graph: full.graph }),
    MODULE_CONFIG.workflow
  )
}

const handleImport = () => {
  importFromFile(() => fetchWorkflows(true))
}

const handleViewWorkflow = (workflow) => {
  if (!openedTabs.value[workflow.id]) openedTabs.value[workflow.id] = { id: workflow.id, type: 'workflow', name: workflow.name, workflow, store: storeToRefs(useFlowStore(workflow.id)) }
  store.switchTab(workflow.id)
}

// 缓存 flowStore 实例，避免模板每渲染重复 defineStore+实例化（每卡片 4 次）
const flowStoreCache = new Map()
const getFlowStore = (id) => {
  let s = flowStoreCache.get(id)
  if (!s) {
    try { s = useFlowStore(id)() } catch { s = null }
    if (s) flowStoreCache.set(id, s)
  }
  return s
}
const getStatus = (id) => getFlowStore(id)?.workflowStatus || 'idle'
const getStatusText = (id) => ({ idle: '未执行', running: '执行中', error: '执行失败', completed: '执行完成', stopping: '停止中', stopped: '已停止' }[getStatus(id)] || '未执行')
const getStatusColor = (id) => ({ idle: 'gray', running: 'blue', error: 'red', completed: 'green', stopping: 'blue', stopped: 'gray' }[getStatus(id)] || 'gray')
const getNoticeNum = (id) => getFlowStore(id)?.noticeNum || 0

watch(searchKeyword, debounce(() => { currentPage.value = 1; fetchWorkflows(true) }, 300))
onActivated(() => fetchWorkflows(true))
</script>

<style lang="less" scoped>
.workflow-card {
  margin-bottom: 16px; transition: all 0.3s;
  &:hover { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,.09); }
  :deep(.arco-card-header) { border: none !important; }
}
.workflow-header { display: flex; align-items: center; font-size: 18px; font-weight: bold; .workflow-icon { margin-right: 12px; } }
.workflow-content .description { color: var(--color-text-3); height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size: 13px; }
.workflow-info { display: flex; justify-content: flex-end; margin-top: 12px; align-items: center; }
</style>
