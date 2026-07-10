<template>
  <ResourceList
    type="workflow"
    create-label="新建工作流"
    search-placeholder="搜索工作流"
    empty-text="暂无工作流"
    v-model:search-keyword="searchKeyword"
    :items="workflows"
    :loading="loading"
    :has-more="hasMore"
    @create="handleCreate"
    @import="handleImport"
    @refresh="fetchWorkflows(true)"
    @edit="handleEdit"
    @category-change="onCategoryChange"
    @scroll="loadMore"
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
                <a-doption @click="handleExport(workflow)">导出</a-doption>
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

  <a-modal v-model:visible="showDependencies" title="依赖列表" width="1000px" :footer="false">
    <a-alert style="margin-bottom:16px" type="warning">导入时如果工作流含有依赖工作流，需要同时兑换未拥有的依赖工作流</a-alert>
    <a-table :data="dependencies" :pagination="false">
      <template #columns>
        <a-table-column title="名称" data-index="name" />
        <a-table-column title="描述" data-index="description" />
        <a-table-column title="积分" data-index="price" />
        <a-table-column title="查看" :width="60" align="center"><template #cell="{ record }"><a-button type="text" @click="handleViewDependency(record)">查看</a-button></template></a-table-column>
      </template>
    </a-table>
  </a-modal>
  <workflow-detail v-model:visible="showWorkflowDetail" :workflowId="detailWorkflowId" />
  <RecycleBin v-model:visible="showTrash" :api="workflowAPI" :on-restored="() => fetchWorkflows(true)" />
</template>

<script setup>
import { ref, watch, onActivated } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconEdit, IconDelete, IconMoreVertical, IconCopy } from '@arco-design/web-vue/es/icon'
import { RiFlowChart } from '@remixicon/vue'
import ResourceList from '@/components/ResourceList.vue'
import WorkflowInfoEditor from './components/WorkflowInfoEditor.vue'
import RecycleBin from '@/components/RecycleBin.vue'
import WorkflowDetail from '../home/components/WorkflowDetail.vue'
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
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 24
const hasMore = ref(true)
const categoryId = ref('')

const showDependencies = ref(false)
const dependencies = ref([])
const detailWorkflowId = ref(null)
const showWorkflowDetail = ref(false)

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

const handleCopy = async (workflow) => {
  try {
    const full = await workflowAPI.getWorkflow(workflow.id)
    await workflowAPI.createWorkflow({ name: `${full.name} - 副本`, description: full.description, category_id: full.category_id, graph: JSON.parse(full.graph) })
    Message.success('复制成功'); fetchWorkflows(true)
  } catch (e) { Message.error('复制失败') }
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

const getStatus = (id) => { try { return useFlowStore(id)().workflowStatus || 'idle' } catch { return 'idle' } }
const getStatusText = (id) => ({ idle: '未执行', running: '执行中', error: '执行失败', completed: '执行完成', stopping: '停止中', stopped: '已停止' }[getStatus(id)] || '未执行')
const getStatusColor = (id) => ({ idle: 'gray', running: 'blue', error: 'red', completed: 'green', stopping: 'blue', stopped: 'gray' }[getStatus(id)] || 'gray')
const getNoticeNum = (id) => { try { return useFlowStore(id)().noticeNum || 0 } catch { return 0 } }

const handleViewDependency = (record) => { detailWorkflowId.value = record.id; showWorkflowDetail.value = true }

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
