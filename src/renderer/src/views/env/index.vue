<template>
  <div class="env-container">
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
              未找到"<span class="keyword">{{ searchKeyword }}</span
              >"相关的环境
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
                  :ellipsis="{
                    showTooltip: true
                  }"
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
          </a-card>
        </a-col>
      </a-row>
      <!-- 加载更多状态 -->
      <LoadMoreState v-if="environments.length > 0" :has-more="hasMore" />
    </a-spin>
    <!-- 创建/编辑环境弹窗 -->

    <a-modal
      v-model:visible="showCreateModal"
      :title="selectedEnv ? '编辑环境' : '新建环境'"
      :mask-closable="false"
      :esc-to-close="false"
      :footer="false"
      unmount-on-close
      width="95vw"
      body-style="height: 100%;"
    >
      <EnvEditor
        v-if="showCreateModal"
        :env-id="selectedEnv?.id"
        @success="handleEditorSuccess"
        @cancel="handleCancel"
      />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, watch, onActivated } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconComputer,
  IconMoreVertical,
  IconRefresh,
  IconImport,
  IconSearch
} from '@arco-design/web-vue/es/icon'
import EnvEditor from './components/EnvEditor.vue'
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
      keyword: searchKeyword.value
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
    selectedEnv.value.name = env.name
    selectedEnv.value.description = env.description
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
    bodyStyle: {
      textAlign: 'center'
    },
    okText: '删除',
    okButtonProps: {
      status: 'danger',
      type: 'primary',
      style: {
        width: '160px'
      }
    },
    cancelButtonProps: {
      style: {
        width: '160px'
      }
    },
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
    // 获取环境完整数据
    const envData = await getEnvironmentDetail(env.id)
    // 构建导出数据结构
    const exportData = {
      app_version: getAppVersion(),
      exportTime: new Date().toISOString(),
      environment: {
        name: envData.name,
        description: envData.description,
        browser_type: envData.browser_type,
        browser_width: envData.browser_width,
        browser_height: envData.browser_height,
        browser_ua: envData.browser_ua,
        url: envData.url,
        storage: envData.storage,
        cookies: envData.cookies
      }
    }

    // 转换为二进制数据
    const jsonString = JSON.stringify(exportData)

    // 创建文件头标识 (AME\0)
    const header = new Uint8Array([0x41, 0x4d, 0x45, 0x00])

    // 压缩数据
    const compressedData = await new Promise((resolve) => {
      const data = new TextEncoder().encode(jsonString)
      import('pako').then(({ deflate }) => {
        const compressed = deflate(data)
        resolve(compressed)
      })
    })

    // 合并文件头和压缩数据
    const fileData = new Uint8Array(header.length + compressedData.length)
    fileData.set(header)
    fileData.set(compressedData, header.length)

    // 创建 Blob
    const blob = new Blob([fileData], { type: 'application/octet-stream' })

    // 创建下载链接
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${env.name} - 环境.ame`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    // Message.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    Message.error('导出失败: ' + error.message)
  }
}

// 处理导入环境
const handleImport = () => {
  // if (!isVip()) return
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
          // 读取文件数据
          const fileData = new Uint8Array(event.target.result)

          // 验证文件头标识
          if (
            fileData.length < 4 ||
            fileData[0] !== 0x41 || // 'A'
            fileData[1] !== 0x4d || // 'M'
            fileData[2] !== 0x45 || // 'E'
            fileData[3] !== 0x00
          ) {
            // '\0'
            throw new Error('无效的文件格式')
          }

          // 解压数据
          const compressedData = fileData.slice(4)
          const decompressedData = await new Promise((resolve, reject) => {
            import('pako').then(({ inflate }) => {
              try {
                const decompressed = inflate(compressedData)
                const text = new TextDecoder().decode(decompressed)
                resolve(text)
              } catch (error) {
                reject(new Error('文件解压失败'))
              }
            })
          })

          // 解析JSON数据
          const importData = JSON.parse(decompressedData)

          // 验证数据结构
          if (!importData.app_version || !importData.environment) {
            throw new Error('无效的文件内容')
          }

          // 验证软件版本
          if (compareVersion(getAppVersion(), importData.app_version) < 0) {
            throw new Error(
              '软件版本不匹配：当前版本:v' +
                getAppVersion() +
                '，导入版本:v' +
                importData.app_version
            )
          }

          // 创建新环境
          const envData = {
            name: importData.environment.name,
            description: importData.environment.description,
            browser_type: importData.environment.browser_type,
            browser_width: importData.environment.browser_width,
            browser_height: importData.environment.browser_height,
            browser_ua: importData.environment.browser_ua,
            url: importData.environment.url,
            storage: importData.environment.storage,
            cookies: importData.environment.cookies
          }

          // 检查是否存在同名环境
          const existingEnvs = await getEnvironments({
            page: 1,
            pageSize: 999999,
            keyword: envData.name
          })

          if (existingEnvs.list.some((e) => e.name === envData.name)) {
            envData.name = `【导入】${envData.name}`
          }

          console.log(envData)

          // 保存环境
          await saveEnvironment(envData)

          Message.success(`成功导入环境 "${envData.name}"`)
          fetchEnvironments(true) // 刷新列表
          clearStoreEnvList()
        } catch (error) {
          console.error('导入失败:', error)
          Message.error('导入失败: ' + error.message)
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('导入失败:', error)
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
})
</script>

<style lang="less" scoped>
.env-container {
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

        .env-url {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--color-text-2);
          font-size: 13px;

          .icon {
            color: var(--color-text-3);
          }
        }
      }

      .env-info {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;

        .info-item {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--color-text-3);
          font-size: 12px;

          .icon {
            font-size: 14px;
          }
        }
      }
    }
  }

  .webview-wrapper {
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background-color: var(--color-bg-2);
    overflow: hidden;
    height: calc(100vh - 300px);

    .webview-header {
      padding: 12px;
      border-bottom: 1px solid var(--color-border);
      background-color: var(--color-bg-1);

      .url-input {
        display: flex;
        gap: 8px;
        :deep(.arco-input-wrapper) {
          flex: 1;
        }
      }
    }
    .preview-container {
      height: calc(100% - 60px);
      background-color: var(--color-fill-2);
    }
  }
}
</style>
