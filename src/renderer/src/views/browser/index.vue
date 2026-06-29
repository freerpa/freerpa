<template>
  <ResourceList
    type="environment"
    create-label="新建浏览器"
    search-placeholder="搜索浏览器"
    empty-text="暂无浏览器"
    v-model:search-keyword="searchKeyword"
    :items="environments"
    :loading="loading"
    :has-more="hasMore"
    @create="handleEdit({})"
    @import="handleImport"
    @refresh="fetchEnvironments(true)"
    @edit="handleEdit"
    @category-change="onCategoryChange"
    @scroll="loadMore"
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
              <a-doption @click="handleDelete(env, index)"><icon-delete /> 删除</a-doption>
              <a-doption @click="handleExport(env)">导出</a-doption>
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
  <RecycleBin v-model:visible="showTrash" :api="browserAPI" :on-restored="() => fetchEnvironments(true)" />
</template>

<script setup>
import { ref, watch, onActivated, onMounted, onUnmounted, reactive } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconEdit, IconDelete, IconMoreVertical, IconStop } from '@arco-design/web-vue/es/icon'
import { RiChromeLine } from '@remixicon/vue'
import ResourceList from '@/components/ResourceList.vue'
import BrowserEditor from './components/BrowserEditor.vue'
import RecycleBin from '@/components/RecycleBin.vue'
import BrowserOpenModal from './components/BrowserOpenModal.vue'
import { useStore } from '@/store'
import { debounce } from 'lodash-es'
import { getAppVersion, compareVersion } from '@/utils/version'

const { browserLocal: browserAPI } = window.electronAPI
const showTrash = ref(false)
const { clearStoreEnvList } = useStore()

const environments = ref([])
const searchKeyword = ref('')
const showCreateModal = ref(false)
const selectedEnv = ref(null)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 24
const hasMore = ref(true)
const categoryId = ref('')
const envStatusMap = reactive({})
const loadingMap = reactive({})
const showOpenModal = ref(false)
const selectedEnvForOpen = ref(null)

const onCategoryChange = (val) => { categoryId.value = val; fetchEnvironments(true) }
const loadMore = () => { currentPage.value++; fetchEnvironments() }

const fetchEnvironments = async (refresh = false) => {
  if (refresh) { currentPage.value = 1; hasMore.value = true }
  loading.value = true
  try {
    const result = await browserAPI.getBrowsers({ page: currentPage.value, pageSize, keyword: searchKeyword.value, category_id: categoryId.value })
    if (result.data.length < pageSize) hasMore.value = false
    environments.value = currentPage.value === 1 ? result.data : [...environments.value, ...result.data]
  } catch (e) { Message.error('获取浏览器列表失败') } finally { loading.value = false }
}

const handleEdit = (env) => { selectedEnv.value = env; showCreateModal.value = true }
const handleEditorSuccess = (env) => { showCreateModal.value = false; clearStoreEnvList(); fetchEnvironments(true) }

const handleDelete = (env, index) => {
  Modal.confirm({
    title: '删除确认', content: `确认删除"${env.name}"吗？`, okText: '删除',
    okButtonProps: { status: 'danger', type: 'primary', style: { width: '160px' } },
    cancelButtonProps: { style: { width: '160px' } },
    onOk: async () => { await browserAPI.deleteBrowser(env.id); environments.value.splice(index, 1); clearStoreEnvList() }
  })
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

const handleExport = async (env) => {
  try {
    const envData = await browserAPI.getBrowser(env.id)
    const exportData = { app_version: getAppVersion(), exportTime: new Date().toISOString(), environment: { name: envData.name, description: envData.description, category_id: envData.category_id, kernel_id: envData.kernel_id, proxy_url: envData.proxy_url } }
    const header = new Uint8Array([0x41, 0x4d, 0x45, 0x00])
    const { deflate } = await import('pako')
    const compressed = deflate(new TextEncoder().encode(JSON.stringify(exportData)))
    const fileData = new Uint8Array(header.length + compressed.length); fileData.set(header); fileData.set(compressed, header.length)
    const blob = new Blob([fileData]); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${env.name} - 浏览器.ame`; a.click(); URL.revokeObjectURL(url)
  } catch (e) { Message.error('导出失败: ' + e.message) }
}

const handleImport = () => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.ame'
  input.onchange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const fileData = new Uint8Array(event.target.result)
        if (fileData[0] !== 0x41 || fileData[1] !== 0x4d || fileData[2] !== 0x45 || fileData[3] !== 0x00) throw new Error('无效的文件格式')
        const { inflate } = await import('pako')
        const importData = JSON.parse(new TextDecoder().decode(inflate(fileData.slice(4))))
        if (!importData.app_version || !importData.environment) throw new Error('无效的文件内容')
        if (compareVersion(getAppVersion(), importData.app_version) < 0) throw new Error('软件版本不匹配')
        const envData = { name: importData.environment.name, description: importData.environment.description, category_id: importData.environment.category_id || '', kernel_id: importData.environment.kernel_id || '', proxy_url: importData.environment.proxy_url || '' }
        const existing = await browserAPI.getBrowsers({ page: 1, pageSize: 999999, keyword: envData.name })
        if (existing.data.some(e => e.name === envData.name)) envData.name = `【导入】${envData.name}`
        await browserAPI.createBrowser(envData)
        Message.success(`成功导入浏览器 "${envData.name}"`)
        fetchEnvironments(true); clearStoreEnvList()
      } catch (e) { Message.error('导入失败: ' + e.message) }
    }
    reader.readAsArrayBuffer(file)
  }
  input.click()
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

watch(searchKeyword, debounce(() => { currentPage.value = 1; fetchEnvironments(true) }, 300))
onActivated(() => { fetchEnvironments(true); fetchBrowserStatus() })
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
