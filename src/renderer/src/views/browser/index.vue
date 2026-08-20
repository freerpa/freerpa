<template>
  <ResourceList
    type="browser"
    create-label="新建浏览器"
    search-placeholder="搜索浏览器"
    empty-text="暂无浏览器"
    v-model:search-keyword="searchKeyword"
    v-model:selected-ids="selectedIds"
    :items="browsers"
    :loading="loading"
    :has-more="hasMore"
    @create="handleEdit({})"
    @import="handleImport"
    @refresh="fetchBrowsers(true)"
    @edit="handleEdit"
    @category-change="onCategoryChange"
    @scroll="loadMore"
    @batch-delete="handleBatchDelete"
    @batch-export="handleBatchExport"
  >
    <template #extra-actions>
      <a-button @click="showTrash = true"><template #icon><icon-delete /></template>回收站</a-button>
    </template>
    <template #card="{ item: env, index }">
      <a-card class="env-card" :bordered="true" hoverable>
        <template #title>
          <div class="env-header">
            <div class="env-icon"><ri-chrome-line /></div>
            <a-typography-text :ellipsis="{ showTooltip: true }" :style="{ margin: '0', width: '100%' }">{{ env.name }}</a-typography-text>
          </div>
        </template>
        <template #extra>
          <a-dropdown>
            <a-button style="padding: 0 0px" type="text"><icon-more-vertical /></a-button>
            <template #content>
              <a-doption @click="handleEdit(env)"><icon-edit /> 编辑</a-doption>
              <a-doption @click="handleCopy(env)"><icon-copy /> 复制</a-doption>
              <a-doption @click="handleDelete(env, index)"><icon-delete /> 删除</a-doption>
              <a-doption @click="handleExport(env)"><icon-export /> 导出</a-doption>
            </template>
          </a-dropdown>
        </template>
        <div class="env-content"><p class="description">{{ env.description || '暂无描述' }}</p></div>
        <div class="env-actions">
          <a-space>
            <a-tag :color="envStatusMap[env.id] ? 'green' : 'gray'" size="large">{{ envStatusMap[env.id] ? '已打开' : '未打开' }}</a-tag>
            <a-button v-if="!envStatusMap[env.id]" type="primary" :loading="loadingMap[env.id]" @click="handleOpenBrowser(env)"><template #icon><ri-chrome-line /></template>打开浏览器</a-button>
            <a-button v-else status="danger" :loading="loadingMap[env.id]" @click="handleCloseBrowser(env)"><template #icon><icon-stop /></template>关闭浏览器</a-button>
          </a-space>
        </div>
      </a-card>
    </template>
  </ResourceList>

  <a-modal v-model:visible="showOpenModal" title="打开浏览器" :footer="false" :mask-closable="false" width="600px">
    <BrowserOpenModal v-if="showOpenModal" :env="selectedEnvForOpen" @success="handleBrowserOpened" @cancel="handleOpenCancel" />
  </a-modal>

  <a-modal v-model:visible="showCreateModal" :title="selectedEnv?.id ? '编辑浏览器' : '新建浏览器'" :footer="false" :mask-closable="false" width="600px" unmount-on-close>
    <BrowserEditor v-if="showCreateModal" :env-id="selectedEnv?.id" @success="handleEditorSuccess" @cancel="showCreateModal=false" />
  </a-modal>
  <RecycleBin v-model:visible="showTrash" :api="browserAPI" :on-restored="() => fetchBrowsers(true)" />

  <CopyCountModal v-model:visible="showCopyModal" name="浏览器" @confirm="handleCopyConfirm" />
</template>

<script setup>
import { ref, watch, onActivated, onMounted, onUnmounted, reactive } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconEdit, IconDelete, IconMoreVertical, IconStop, IconExport, IconCopy } from '@arco-design/web-vue/es/icon'
import { RiChromeLine } from '@remixicon/vue'
import ResourceList from '@/components/ResourceList.vue'
import BrowserEditor from './components/BrowserEditor.vue'
import RecycleBin from '@/components/RecycleBin.vue'
import BrowserOpenModal from './components/BrowserOpenModal.vue'
import CopyCountModal from '@/components/CopyCountModal.vue'
import { debounce } from 'lodash-es'
import { exportToFile, batchExportToFile, importFromFile, MODULE_CONFIG } from '@/utils/importer'

const { browserLocal: browserAPI } = window.electronAPI
const showTrash = ref(false)

const browsers = ref([])
const searchKeyword = ref('')
const showCreateModal = ref(false)
const selectedEnv = ref(null)
const selectedIds = ref([])
const showCopyModal = ref(false)
const copyTarget = ref(null)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 24
const hasMore = ref(true)
const categoryId = ref('')
const envStatusMap = reactive({})
const loadingMap = reactive({})
const showOpenModal = ref(false)
const selectedEnvForOpen = ref(null)

const onCategoryChange = (val) => { categoryId.value = val; fetchBrowsers(true) }
const loadMore = () => { currentPage.value++; fetchBrowsers() }

const fetchBrowsers = async (refresh = false) => {
  if (refresh) { currentPage.value = 1; hasMore.value = true }
  loading.value = true
  try {
    const result = await browserAPI.getBrowsers({ page: currentPage.value, pageSize, keyword: searchKeyword.value, category_id: categoryId.value })
    if (result.data.length < pageSize) hasMore.value = false
    browsers.value = currentPage.value === 1 ? result.data : [...browsers.value, ...result.data]
  } catch (e) { Message.error('获取浏览器列表失败') } finally { loading.value = false }
}

const handleEdit = (env) => { selectedEnv.value = env; showCreateModal.value = true }
const handleEditorSuccess = (env) => { showCreateModal.value = false; fetchBrowsers(true) }

const handleDelete = (env, index) => {
  Modal.confirm({
    title: '删除确认', content: `确认删除"${env.name}"吗？`, okText: '删除',
    okButtonProps: { status: 'danger', type: 'primary', style: { width: '160px' } },
    cancelButtonProps: { style: { width: '160px' } },
    onOk: async () => { await browserAPI.deleteBrowser(env.id); browsers.value.splice(index, 1) }
  })
}

const handleCopy = (env) => { copyTarget.value = env; showCopyModal.value = true }

const handleCopyConfirm = async (count) => {
  const env = copyTarget.value
  try {
    const full = await browserAPI.getBrowser(env.id)
    for (let i = 1; i <= count; i++) {
      const suffix = count > 1 ? ` - 副本${i}` : ' - 副本'
      await browserAPI.createBrowser({
        name: `${full.name}${suffix}`,
        description: full.description,
        category_id: full.category_id,
        kernel_id: full.kernel_id,
        proxy_url: full.proxy_url,
        config: full.config || {}
      })
    }
    Message.success(`已复制 ${count} 份`); fetchBrowsers(true)
  } catch (e) { Message.error('复制失败') }
}

// 批量移入回收站
const handleBatchDelete = async (ids) => {
  try {
    await Promise.all(ids.map((id) => browserAPI.deleteBrowser(id)))
    Message.success(`已移入回收站 ${ids.length} 项`)
  } catch (e) { Message.error('批量删除失败') }
  selectedIds.value = []
  fetchBrowsers(true)
}

const handleOpenBrowser = async (env) => {
  try { selectedEnvForOpen.value = await browserAPI.getBrowser(env.id) || env } catch (e) { selectedEnvForOpen.value = env }
  showOpenModal.value = true
}
const handleBrowserOpened = (envId) => { envStatusMap[envId] = true; showOpenModal.value = false }
const handleOpenCancel = () => { showOpenModal.value = false }

const handleCloseBrowser = async (env) => {
  loadingMap[env.id] = true
  try {
    const res = await window.electronAPI.env.closeBrowser({ envId: env.id })
    if (res.code === 200) envStatusMap[env.id] = false
  } finally { loadingMap[env.id] = false }
}

const buildBrowserPayload = (d) => ({
  name: d.name,
  description: d.description,
  category_id: d.category_id,
  kernel_id: d.kernel_id,
  proxy_url: d.proxy_url
})

const handleExport = async (env) => {
  const envData = await browserAPI.getBrowser(env.id)
  await exportToFile(async () => buildBrowserPayload(envData), MODULE_CONFIG.browser)
}

const handleBatchExport = async (ids) => {
  const envDataList = await Promise.all(ids.map((id) => browserAPI.getBrowser(id)))
  await batchExportToFile(async () => envDataList.map(buildBrowserPayload), MODULE_CONFIG.browser)
}

const handleImport = () => {
  importFromFile(() => fetchBrowsers(true))
}

const fetchBrowserStatus = async () => {
  try { const res = await window.electronAPI.env.getAllBrowserStatus(); if (res.code === 200) Object.assign(envStatusMap, res.data) } catch (e) {}
}

let remove1, remove2, remove3
onMounted(() => {
  const envAPI = window.electronAPI?.env
  if (envAPI) {
    remove1 = envAPI.onBrowserOpened(({ envId }) => { envStatusMap[envId] = true; loadingMap[envId] = false })
    remove2 = envAPI.onBrowserClosed(({ envId }) => { envStatusMap[envId] = false; loadingMap[envId] = false })
    remove3 = envAPI.onSaveSession(async ({ envId, fingerprint }) => {
      if (fingerprint) { try { await browserAPI.updateBrowser({ id: envId, config: { fingerprint } }) } catch (e) {} }
    })
  }
  fetchBrowserStatus()
})
onUnmounted(() => { remove1?.(); remove2?.(); remove3?.() })

watch(searchKeyword, debounce(() => { currentPage.value = 1; fetchBrowsers(true) }, 300))
onActivated(() => { fetchBrowsers(true); fetchBrowserStatus() })
</script>

<style lang="less" scoped>
.env-card {
  margin-bottom: 16px; transition: all 0.3s;
  &:hover { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,.09); }
  :deep(.arco-card-header) { border: none !important; }
}
.env-header { display: flex; align-items: center; font-size: 18px; font-weight: bold; .env-icon { margin-right: 12px; } }
.env-content .description { color: var(--color-text-3); height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size: 13px; }
.env-actions { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
