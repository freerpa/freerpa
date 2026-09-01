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
              <a-doption @click="exportBrowser(env)"><icon-export /> 导出</a-doption>
            </template>
          </a-dropdown>
        </template>
        <div class="env-content"><p class="description">{{ env.description || '暂无描述' }}</p></div>
        <div class="env-actions">
          <a-space>
            <a-tag v-if="envStatusMap[env.id]" :color="'green'" size="large" class="status-tag" @click="handleFocusBrowser(env)" title="点击置顶当前浏览器"><template #icon><ri-eye-line /></template>{{ '已打开' }}</a-tag>
            <a-tag v-else :color="'gray'" size="large">{{ '未打开' }}</a-tag>
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
  <RecycleBin v-model:visible="showTrash" :api="browserAPI" :on-restored="refetch" />

  <CopyCountModal v-model:visible="showCopyModal" name="浏览器" @confirm="(count) => handleCopyConfirm(count, copyBrowser)" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, onActivated, reactive } from 'vue'
import { IconEdit, IconDelete, IconMoreVertical, IconStop, IconExport, IconCopy } from '@arco-design/web-vue/es/icon'
import { RiChromeLine, RiEyeLine } from '@remixicon/vue'
import ResourceList from '@/components/ResourceList.vue'
import BrowserEditor from './components/BrowserEditor.vue'
import RecycleBin from '@/components/RecycleBin.vue'
import BrowserOpenModal from './components/BrowserOpenModal.vue'
import CopyCountModal from '@/components/CopyCountModal.vue'
import { MODULE_CONFIG } from '@/utils/importer'
import { useResourceList } from '@/composables/useResourceList'

const { browserLocal: browserAPI } = window.electronAPI
const showTrash = ref(false)
const showCreateModal = ref(false)
const selectedEnv = ref(null)
const showOpenModal = ref(false)
const selectedEnvForOpen = ref(null)
const envStatusMap = reactive({})
const loadingMap = reactive({})

const {
  items: browsers,
  searchKeyword, selectedIds, loading, hasMore, showCopyModal,
  onCategoryChange, loadMore, refetch,
  handleCopy, handleCopyConfirm,
  confirmDelete, handleBatchDelete,
  handleExport, handleBatchExport, handleImport
} = useResourceList({
  api: {
    list: (params) => browserAPI.getBrowsers(params),
    get: (id) => browserAPI.getBrowser(id),
    remove: (id) => browserAPI.deleteBrowser(id)
  },
  moduleConfig: MODULE_CONFIG.browser,
  listErrorMsg: '获取浏览器列表失败'
})

const handleEdit = (env) => { selectedEnv.value = env; showCreateModal.value = true }
const handleEditorSuccess = () => { showCreateModal.value = false; refetch() }

const handleDelete = (env, index) => {
  confirmDelete(env, (e) => e.name, async () => {
    await browserAPI.deleteBrowser(env.id)
    browsers.value.splice(index, 1)
  })
}

const copyBrowser = async (env, suffix) => {
  const full = await browserAPI.getBrowser(env.id)
  await browserAPI.createBrowser({
    name: `${full.name}${suffix}`,
    description: full.description,
    category_id: full.category_id,
    kernel_id: full.kernel_id,
    proxy_url: full.proxy_url,
    config: full.config || {}
  })
}

const batchDelete = (ids) => handleBatchDelete(ids, (id) => browserAPI.deleteBrowser(id))

const handleOpenBrowser = async (env) => {
  try { selectedEnvForOpen.value = await browserAPI.getBrowser(env.id) || env } catch { selectedEnvForOpen.value = env }
  showOpenModal.value = true
}
const handleFocusBrowser = async (env) => {
  try {
    await window.electronAPI.env.focusBrowser({ envId: env.id })
  } catch { /* 置顶失败静默 */ }
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

const exportBrowser = (env) => handleExport(env, buildBrowserPayload)
const batchExport = (ids) => handleBatchExport(ids, buildBrowserPayload)

const fetchBrowserStatus = async () => {
  try {
    const res = await window.electronAPI.env.getAllBrowserStatus()
    if (res.code === 200) Object.assign(envStatusMap, res.data)
  } catch {}
}

let remove1, remove2, remove3
onMounted(() => {
  const envAPI = window.electronAPI?.env
  if (envAPI) {
    remove1 = envAPI.onBrowserOpened(({ envId }) => { envStatusMap[envId] = true; loadingMap[envId] = false })
    remove2 = envAPI.onBrowserClosed(({ envId }) => { envStatusMap[envId] = false; loadingMap[envId] = false })
    remove3 = envAPI.onSaveSession(async ({ envId, fingerprint }) => {
      if (fingerprint) { try { await browserAPI.updateBrowser({ id: envId, config: { fingerprint } }) } catch {} }
    })
  }
  fetchBrowserStatus()
})
onUnmounted(() => { remove1?.(); remove2?.(); remove3?.() })

onActivated(() => { fetchBrowserStatus() })
</script>

<style lang="less" scoped>
.env-card {
  margin-bottom: 16px; transition: all 0.3s;
  &:hover { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,.09); }
  :deep(.arco-card-header) { border: none !important; }
}
.env-header { display: flex; align-items: center; font-size: 18px; font-weight: bold; .env-icon { margin-right: 12px; } }
.env-content .description { color: var(--color-text-3); height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size: 13px; }
.env-actions { display: flex; justify-content: flex-end; margin-top: 12px; .status-tag { cursor: pointer; user-select: none; } }
</style>
