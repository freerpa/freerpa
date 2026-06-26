<template>
  <div class="env-container">
    <Category type="environment" @change="handleCategoryChange" />
    <div class="env-content">
      <!-- 顶部操作栏 -->
      <div class="operation-bar">
        <a-space>
          <a-button type="primary" @click="handleEdit({})">
            <template #icon><icon-plus /></template>
            新建环境
          </a-button>
          <a-button @click="handleImport">
            <template #icon><icon-import /></template>
            导入环境
          </a-button>
          <a-button @click="fetchEnvironments(true)" :loading="loading">
            <template #icon><icon-refresh /></template>
            刷新
          </a-button>
          <a-input v-model="searchKeyword" placeholder="搜索环境" style="width: 300px" allow-clear>
            <template #prefix><icon-search /></template>
          </a-input>
        </a-space>
      </div>

      <!-- 环境列表 -->
      <a-spin :loading="loading" tip="加载中..." class="env-list scrollbar" @scroll="handleScroll">
        <div v-if="environments.length === 0" class="empty-wrapper">
          <a-empty>
            <p class="empty-text">
              <template v-if="searchKeyword">
                未找到"<span class="keyword">{{ searchKeyword }}</span>"相关的环境
              </template>
              <template v-else> 暂无环境 </template>
            </p>
          </a-empty>
        </div>

        <a-row :gutter="8">
          <a-col
            :xs="{ span: 24 }"
            :sm="{ span: 12 }"
            :md="{ span: 12 }"
            :lg="{ span: 8 }"
            :xl="{ span: 8 }"
            :xxl="{ span: 6 }"
            v-for="(env, index) in environments"
            :key="env.id"
            @dblclick="handleEdit(env)"
          >
            <a-card class="env-card" :bordered="true" hoverable>
              <template #title>
                <div class="env-header">
                  <div class="env-icon">
                    <icon-computer />
                  </div>
                  <a-typography-text
                    :ellipsis="{ showTooltip: true }"
                    :style="{ margin: '0', width: '100%' }"
                  >
                    {{ env.name }}
                  </a-typography-text>
                </div>
              </template>
              <template #extra>
                <a-dropdown>
                  <a-button style="padding: 0 0px" type="text">
                    <icon-more-vertical />
                  </a-button>
                  <template #content>
                    <a-doption @click="handleEdit(env)"> <icon-edit /> 编辑 </a-doption>
                    <a-doption @click="handleDelete(env, index)"> <icon-delete /> 删除 </a-doption>
                    <a-doption @click="handleExport(env)">
                      <a-space :size="4"> <vipIcon :size="14" /> 导出 </a-space>
                    </a-doption>
                  </template>
                </a-dropdown>
              </template>

              <div class="env-content">
                <p class="description">{{ env.description || '暂无描述' }}</p>
              </div>

              <!-- 操作区域：状态标签 + 打开/关闭按钮（参考工作流列表） -->
              <div class="env-actions">
                <a-space>
                  <a-tag
                    :color="envStatusMap[env.id] ? 'green' : 'gray'"
                    size="large"
                  >
                    {{ envStatusMap[env.id] ? '已打开' : '未打开' }}
                  </a-tag>
                  <a-button
                    v-if="!envStatusMap[env.id]"
                    type="primary"
                    size="medium"
                    :loading="loadingMap[env.id]"
                    @click="handleOpenBrowser(env)"
                  >
                    <template #icon><icon-play-arrow /></template>
                    打开浏览器
                  </a-button>
                  <a-button
                    v-else
                    type="outline"
                    status="danger"
                    size="medium"
                    :loading="loadingMap[env.id]"
                    @click="handleCloseBrowser(env)"
                  >
                    <template #icon><icon-stop /></template>
                    关闭浏览器
                  </a-button>
                </a-space>
              </div>
            </a-card>
          </a-col>
        </a-row>
        <LoadMoreState v-if="environments.length > 0" :has-more="hasMore" />
      </a-spin>

      <!-- 打开浏览器 Modal -->
      <a-modal
        v-model:visible="showOpenModal"
        title="打开浏览器"
        :footer="false"
        :mask-closable="false"
        :esc-to-close="false"
        width="600px"
        class="open-browser-modal"
      >
        <EnvOpenModal
          v-if="showOpenModal"
          :env="selectedEnvForOpen"
          @success="handleBrowserOpened"
          @cancel="handleOpenCancel"
        />
      </a-modal>

      <!-- 创建/编辑环境弹窗 -->
      <a-modal
        v-model:visible="showCreateModal"
        :title="selectedEnv ? '编辑环境' : '新建环境'"
        :mask-closable="false"
        :esc-to-close="false"
        :footer="false"
        unmount-on-close
        width="600px"
      >
        <EnvEditor
          v-if="showCreateModal"
          :env-id="selectedEnv?.id"
          @success="handleEditorSuccess"
          @cancel="handleCancel"
        />
      </a-modal>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onActivated, onMounted, onUnmounted, reactive, provide } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconComputer,
  IconMoreVertical,
  IconRefresh,
  IconImport,
  IconSearch,
  IconPlayArrow,
  IconStop
} from '@arco-design/web-vue/es/icon'
import EnvEditor from './components/EnvEditor.vue'
import EnvOpenModal from './components/EnvOpenModal.vue'
import Category from '@/components/Category.vue'
import LoadMoreState from '@/components/LoadMoreState.vue'
import {
  getEnvironments,
  deleteEnvironment,
  getEnvironmentDetail,
  saveEnvironment
} from '@/api/env'
import { useStore } from '@/store'
import { debounce } from 'lodash-es'
import { getAppVersion, compareVersion } from '@/utils/version'

const { isVip, vipIcon, clearStoreEnvList } = useStore()

// 数据状态
const environments = ref([])
const searchKeyword = ref('')
const showCreateModal = ref(false)
const currentPage = ref(1)
const pageSize = 24
const hasMore = ref(true)

// 编辑器状态
const selectedEnv = ref(null)
const loading = ref(false)

// 浏览器状态管理
const envStatusMap = reactive({})  // { [envId]: true/false }
const loadingMap = reactive({})     // { [envId]: true/false }

// 打开浏览器 Modal
const showOpenModal = ref(false)
const selectedEnvForOpen = ref(null)

// 分类（参考工作流列表）
const category = ref('')
provide('category', category)

const handleCategoryChange = (val) => {
  const newCategory = val === 'all' ? '' : val
  if (newCategory !== category.value) {
    category.value = newCategory
    fetchEnvironments(true)
  }
}

// 获取浏览器状态列表
const fetchBrowserStatus = async () => {
  try {
    const envAPI = window.electronAPI.env
    const res = await envAPI.getAllBrowserStatus()
    if (res.code === 200) {
      Object.assign(envStatusMap, res.data)
    }
  } catch (e) {
    // 忽略
  }
}

// 打开浏览器
const handleOpenBrowser = async (env) => {
  try {
    // 获取完整环境详情（含 proxy_url、kernel_id、proxy_direct）
    const detail = await getEnvironmentDetail(env.id)
    if (detail) {
      selectedEnvForOpen.value = detail
    } else {
      selectedEnvForOpen.value = env
    }
  } catch (e) {
    selectedEnvForOpen.value = env
  }
  showOpenModal.value = true
}

// 浏览器已打开回调
const handleBrowserOpened = (envId) => {
  envStatusMap[envId] = true
  showOpenModal.value = false
  selectedEnvForOpen.value = null
}

// 取消打开
const handleOpenCancel = () => {
  showOpenModal.value = false
  selectedEnvForOpen.value = null
}

// 关闭浏览器
const handleCloseBrowser = async (env) => {
  try {
    loadingMap[env.id] = true
    const envAPI = window.electronAPI.env
    const res = await envAPI.closeBrowser({ envId: env.id })
    if (res.code === 200) {
      envStatusMap[env.id] = false
      Message.success('浏览器已关闭')
    } else {
      Message.error(res.message || '关闭失败')
    }
  } catch (error) {
    Message.error('关闭失败: ' + error.message)
  } finally {
    loadingMap[env.id] = false
  }
}

// 处理滚动事件
const handleScroll = (e) => {
  const scrollTop = e.target.scrollTop
  const scrollHeight = e.target.scrollHeight
  const clientHeight = e.target.clientHeight
  if (scrollTop >= scrollHeight - clientHeight && hasMore.value) {
    currentPage.value++
    fetchEnvironments()
  }
}

// 获取环境列表
const fetchEnvironments = async (refresh = false) => {
  if (refresh) {
    currentPage.value = 1
    hasMore.value = true
  }
  try {
    loading.value = true
    const result = await getEnvironments({
      page: currentPage.value,
      pageSize,
      keyword: searchKeyword.value,
      category: category.value
    })
    if (result.list.length < pageSize) {
      hasMore.value = false
    }
    if (currentPage.value === 1) {
      environments.value = result.list
    } else {
      environments.value = [...environments.value, ...result.list]
    }
  } catch (error) {
    Message.error('获取环境列表失败')
  } finally {
    loading.value = false
  }
}

// 处理编辑
const handleEdit = (env) => {
  selectedEnv.value = env
  showCreateModal.value = true
}

// 处理编辑器回调
const handleEditorSuccess = (env) => {
  if (selectedEnv.value) {
    Object.assign(selectedEnv.value, env)
  }
  showCreateModal.value = false
  clearStoreEnvList()
  fetchEnvironments(true)
}

// 处理取消
const handleCancel = () => {
  showCreateModal.value = false
}

// 处理删除
const handleDelete = (env, index) => {
  Modal.confirm({
    title: '删除确认',
    content: `确认删除"${env.name}"吗？此操作不可恢复!`,
    width: 400,
    bodyStyle: { textAlign: 'center' },
    okText: '删除',
    okButtonProps: {
      status: 'danger',
      type: 'primary',
      style: { width: '160px' }
    },
    cancelButtonProps: { style: { width: '160px' } },
    onOk: async () => {
      try {
        await deleteEnvironment(env.id)
        Message.success('删除成功')
        environments.value.splice(index, 1)
        clearStoreEnvList()
      } catch (error) {
        Message.error('删除失败')
      }
    }
  })
}

// 处理导出环境
const handleExport = async (env) => {
  if (!isVip()) return
  try {
    const envData = await getEnvironmentDetail(env.id)
    const exportData = {
      app_version: getAppVersion(),
      exportTime: new Date().toISOString(),
      environment: {
        name: envData.name,
        description: envData.description,
        category: envData.category,
        kernel_id: envData.kernel_id,
        proxy_url: envData.proxy_url
      }
    }
    const jsonString = JSON.stringify(exportData)
    const header = new Uint8Array([0x41, 0x4d, 0x45, 0x00])
    const compressedData = await new Promise((resolve) => {
      const data = new TextEncoder().encode(jsonString)
      import('pako').then(({ deflate }) => {
        const compressed = deflate(data)
        resolve(compressed)
      })
    })
    const fileData = new Uint8Array(header.length + compressedData.length)
    fileData.set(header)
    fileData.set(compressedData, header.length)
    const blob = new Blob([fileData], { type: 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${env.name} - 环境.ame`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
    Message.error('导出失败: ' + error.message)
  }
}

// 处理导入环境
const handleImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.ame'
  input.onchange = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const fileData = new Uint8Array(event.target.result)
          if (fileData.length < 4 || fileData[0] !== 0x41 || fileData[1] !== 0x4d || fileData[2] !== 0x45 || fileData[3] !== 0x00) {
            throw new Error('无效的文件格式')
          }
          const compressedData = fileData.slice(4)
          const decompressedData = await new Promise((resolve, reject) => {
            import('pako').then(({ inflate }) => {
              try {
                const decompressed = inflate(compressedData)
                const text = new TextDecoder().decode(decompressed)
                resolve(text)
              } catch (error) { reject(new Error('文件解压失败')) }
            })
          })
          const importData = JSON.parse(decompressedData)
          if (!importData.app_version || !importData.environment) {
            throw new Error('无效的文件内容')
          }
          if (compareVersion(getAppVersion(), importData.app_version) < 0) {
            throw new Error('软件版本不匹配：当前版本:v' + getAppVersion() + '，导入版本:v' + importData.app_version)
          }
          const envData = {
            name: importData.environment.name,
            description: importData.environment.description,
            category: importData.environment.category || '',
            kernel_id: importData.environment.kernel_id || '',
            proxy_url: importData.environment.proxy_url || ''
          }
          const existingEnvs = await getEnvironments({ page: 1, pageSize: 999999, keyword: envData.name })
          if (existingEnvs.list.some((e) => e.name === envData.name)) {
            envData.name = `【导入】${envData.name}`
          }
          await saveEnvironment(envData)
          Message.success(`成功导入环境 "${envData.name}"`)
          fetchEnvironments(true)
          clearStoreEnvList()
        } catch (error) {
          Message.error('导入失败: ' + error.message)
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      Message.error('导入失败: ' + error.message)
    }
  }
  input.click()
}

// 监听搜索关键字变化
watch(
  searchKeyword,
  debounce(() => {
    currentPage.value = 1
    fetchEnvironments(true)
  }, 300)
)

// 页面激活时刷新数据
onActivated(() => {
  fetchEnvironments(true)
  fetchBrowserStatus()
})

// 监听浏览器事件
let removeBrowserOpened = null
let removeBrowserClosed = null
let removeSaveSession = null

onMounted(() => {
  try {
    const envAPI = window.electronAPI?.env
    if (envAPI && envAPI.onBrowserOpened) {
      removeBrowserOpened = envAPI.onBrowserOpened(({ envId }) => {
        envStatusMap[envId] = true
        loadingMap[envId] = false
      })
    }
    if (envAPI && envAPI.onBrowserClosed) {
      removeBrowserClosed = envAPI.onBrowserClosed(({ envId }) => {
        envStatusMap[envId] = false
        loadingMap[envId] = false
      })
    }
    if (envAPI && envAPI.onSaveSession) {
      removeSaveSession = envAPI.onSaveSession(async ({ envId, fingerprint }) => {
        if (fingerprint) {
          try {
            await saveEnvironment({ id: envId, fingerprint })
          } catch (e) {
            console.warn('保存 fingerprint 失败:', e)
          }
        }
      })
    }
    fetchBrowserStatus()
  } catch (e) {
    console.warn('env IPC not available:', e)
  }
})

onUnmounted(() => {
  if (removeBrowserOpened) removeBrowserOpened()
  if (removeBrowserClosed) removeBrowserClosed()
  if (removeSaveSession) removeSaveSession()
})
</script>

<style lang="less" scoped>
.env-container {
  display: flex;
  &-content {
    flex: 1;
  }
  .operation-bar {
    padding: 16px 16px 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .env-list {
    width: 100%;
    min-height: 200px;
    overflow-y: auto;
    overflow-x: hidden;
    height: calc(100vh - 112px);
    padding: 4px 16px 16px 16px;
    .empty-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      background-color: var(--color-bg-2);
      border-radius: var(--border-radius-small);
      border: 1px dashed var(--color-border-2);
    }
    .env-card {
      margin-bottom: 16px;
      transition: all 0.3s;
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
      }
      :deep(.arco-card-header) {
        border: none !important;
      }
      .env-header {
        display: flex;
        align-items: center;
        font-size: 18px;
        font-weight: bold;
        .env-icon {
          margin-right: 12px;
        }
      }
      .env-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        .description {
          color: var(--color-text-3);
          height: 60px;
          overflow: hidden;
          text-overflow: ellipsis;
          word-wrap: break-word;
          word-break: break-all;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          font-size: 13px;
          line-height: 1.6;
        }
      }
      .env-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
      }
    }
  }
}
</style>
