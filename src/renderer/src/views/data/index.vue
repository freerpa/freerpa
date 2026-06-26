<template>
  <div class="data-container">
    <!-- 顶部操作栏 -->
    <div class="operation-bar">
      <a-space>
        <a-button type="primary" @click="handleEdit({})">
          <template #icon><icon-plus /></template>
          新建数据表
        </a-button>
        <a-button @click="handleImport">
          <template #icon><icon-import /></template>
          导入数据表
        </a-button>
        <a-button @click="fetchModels(true)" :loading="loading">
          <template #icon><icon-refresh /></template>
          刷新
        </a-button>
        <a-input v-model="searchKeyword" placeholder="搜索数据表" style="width: 300px" allow-clear>
          <template #prefix><icon-search /></template>
        </a-input>
      </a-space>
    </div>
    <!-- 数据表列表 -->
    <a-spin :loading="loading" tip="加载中..." class="model-list scrollbar" @scroll="handleScroll">
      <div v-if="models.length === 0" class="empty-wrapper">
        <a-empty>
          <p class="empty-text">
            <template v-if="searchKeyword">
              未找到 "<span class="keyword">{{ searchKeyword }}</span
              >" 相关的数据表
            </template>
            <template v-else>暂无数据表</template>
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
          v-for="(model, index) in models"
          :key="model.id"
          @dblclick="handleEdit(model)"
        >
          <a-card class="model-card" :title="model.name" :bordered="true" hoverable>
            <template #title
              ><div class="model-header">
                <div class="model-icon">
                  <ri-database2-line />
                </div>

                <a-typography-text
                  :ellipsis="{
                    showTooltip: true
                  }"
                  :style="{ margin: '0', width: '100%' }"
                >
                  {{ model.name }}
                </a-typography-text>
              </div></template
            >
            <template #extra>
              <a-dropdown>
                <a-button style="padding: 0 0px" type="text">
                  <icon-more-vertical />
                </a-button>
                <template #content>
                  <a-doption @click="handleEdit(model)"> <icon-edit /> 编辑 </a-doption>
                  <a-doption @click="handleCopy(model)"> <icon-copy /> 复制 </a-doption>
                  <a-doption @click="handleDelete(model, index)"> <icon-delete /> 删除 </a-doption>
                  <a-doption @click="handleExport(model)">
                    <a-space :size="4"> <vipIcon :size="14" /> 导出 </a-space>
                  </a-doption>
                </template>
              </a-dropdown>
            </template>

            <div class="model-content">
              <p class="description">{{ model.description || '暂无描述' }}</p>
            </div>
            <div class="model-info">
              <div class="model-stats">
                <div class="stat-item"><icon-settings /> {{ model.field_stats.total }} 个字段</div>
                <div class="stat-item">
                  <ri-database2-line /> {{ model.data_count || 0 }} 条数据
                </div>
              </div>
              <a-button type="primary" @click="handleViewData(model)">
                <template #icon><ri-database2-line /></template>
                打开数据表
              </a-button>
            </div>
          </a-card>
        </a-col>
      </a-row>
      <!-- 加载更多状态 -->
      <LoadMoreState v-if="models.length > 0" :has-more="hasMore" />
    </a-spin>
    <!-- 使用独立的模型编辑器组件 -->
    <ModelEditor
      v-model:visible="showCreateModal"
      :model-id="editingModel?.id"
      @success="handleEditorSuccess"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onActivated } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconMoreVertical,
  IconSearch,
  IconSettings,
  IconStorage,
  IconInfoCircle,
  IconEye,
  IconRefresh,
  IconCopy,
  IconImport
} from '@arco-design/web-vue/es/icon'
import { RiDatabase2Line } from '@remixicon/vue'
import ModelEditor from './components/ModelEditor.vue'
import LoadMoreState from '@/components/LoadMoreState.vue'
import { debounce } from 'lodash-es'
import { storeToRefs } from 'pinia'
import { useStore } from '@/store'
import { getAppVersion, compareVersion } from '@/utils/version'
const store = useStore()
const { openedTabs } = storeToRefs(store)
const { isVip, vipIcon, switchTab } = store

// API 引用
const { data: dataAPI } = window.electronAPI

// 数据状态
const models = ref([])
const searchKeyword = ref('')
const showCreateModal = ref(false)
const editingModel = ref(null)
const currentPage = ref(1)
const pageSize = 24
const loading = ref(false)
const hasMore = ref(true)

// 处理滚动事件
const handleScroll = (e) => {
  const scrollTop = e.target.scrollTop
  const scrollHeight = e.target.scrollHeight
  const clientHeight = e.target.clientHeight
  if (scrollTop >= scrollHeight - clientHeight && hasMore.value) {
    currentPage.value++
    fetchModels()
  }
}
// 获取模型列表
const fetchModels = async (refresh = false) => {
  if (refresh) {
    currentPage.value = 1
    hasMore.value = true
  }
  loading.value = true
  try {
    const result = await dataAPI.getModels({
      page: currentPage.value,
      pageSize,
      keyword: searchKeyword.value
    })
    if (result.data.length < pageSize) {
      hasMore.value = false
    }
    if (currentPage.value === 1) {
      models.value = result.data
    } else {
      models.value = [...models.value, ...result.data]
    }
  } catch (error) {
    Message.error('获取数据表失败')
  } finally {
    loading.value = false
  }
}

// 处理编辑
const handleEdit = (model) => {
  console.log(model)
  editingModel.value = model
  showCreateModal.value = true
}

// 处理编辑器回调
const handleEditorSuccess = (model) => {
  if (editingModel.value) {
    editingModel.value.name = model.name
    editingModel.value.description = model.description
    editingModel.value.fields = JSON.stringify(model.fields)
  }
  showCreateModal.value = false
  fetchModels(true)
}

// 处理删除
const handleDelete = async (model, index) => {
  Modal.confirm({
    title: '删除确认',
    content: `确认删除 "${model.name}" 吗？此操作不可恢复!`,
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
    async onOk() {
      try {
        await dataAPI.deleteModel(model.id)
        Message.success('删除成功')
        models.value.splice(index, 1)
      } catch (error) {
        Message.error('删除失败')
      }
    }
  })
}

// 监听搜索关键字变化
watch(
  searchKeyword,
  debounce(() => {
    currentPage.value = 1
    fetchModels(true)
  }, 300)
)

// 页面加载时获取数据
onMounted(() => {
  fetchModels(true)
})

// 查看数据
const handleViewData = (model) => {
  if (!openedTabs.value[model.id]) {
    openedTabs.value[model.id] = {
      id: model.id,
      type: 'dataViewer',
      name: model.name,
      model
    }
  }
  switchTab(model.id)
}

// 页面激活时刷新数据
onActivated(() => {
  fetchModels(true)
})

// 处理复制
const handleCopy = async (model) => {
  try {
    await dataAPI.copyModel(model.id)
    Message.success({
      content: '复制成功',
      duration: 2000
    })
    fetchModels(true)
  } catch (error) {
    Message.error({
      content: '复制失败: ' + error.message,
      duration: 3000
    })
  } finally {
  }
}

// 处理导出模型
const handleExport = async (model) => {
  if (!isVip()) return
  try {
    loading.value = true
    // 获取模型完整数据
    const modelData = await dataAPI.getModel(model.id)

    // let page = 1
    // let total = 1
    // const data = []
    // while (data.length < total) {
    //   // 获取模型的所有数据记录
    //   const result = await dataAPI.getModelData({
    //     modelId: model.id,
    //     page,
    //     pageSize: 100000
    //   })
    //   data.push(...result.data)
    //   total = result.total
    //   page++
    // }
    // 构建导出数据结构
    const exportData = {
      app_version: getAppVersion(),
      exportTime: new Date().toISOString(),
      model: {
        name: model.name,
        description: model.description,
        fields: JSON.parse(modelData.fields)
      },
      data: []
    }

    // 转换为二进制数据
    const jsonString = JSON.stringify(exportData)

    // 创建文件头标识 (AMD\0)
    const header = new Uint8Array([0x41, 0x4d, 0x44, 0x00])

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
    link.download = `${model.name} - 数据表.amd`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    // Message.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    Message.error('导出失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 处理导入模型
const handleImport = () => {
  // if (!isVip()) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.amd'

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
            fileData[2] !== 0x44 || // 'D'
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
          if (!importData.app_version || !importData.model || !importData.data) {
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

          // 创建新模型
          const modelData = {
            name: importData.model.name,
            description: importData.model.description,
            fields: importData.model.fields
          }

          // 检查是否存在同名模型
          const existingModels = await dataAPI.getModels({
            page: 1,
            pageSize: 999999,
            keyword: modelData.name
          })

          if (existingModels.data.some((m) => m.name === modelData.name)) {
            modelData.name = `【导入】${modelData.name}`
          }

          // 创建模型
          const newModelId = await dataAPI.createModel(modelData)

          // 批量导入数据
          // if (importData.data.length > 0) {
          //   const total = importData.data.length
          //   let imported = 0
          //   const batchSize = 1000

          //   for (let i = 0; i < total; i += batchSize) {
          //     const batch = importData.data.slice(i, i + batchSize)
          //     await dataAPI.batchCreateModelData({
          //       modelId: newModelId,
          //       data: batch,
          //       batchSize
          //     })
          //     imported += batch.length
          //     Message.info({
          //       content: `导入进度: ${imported}/${total}`,
          //       id: 'import-progress'
          //     })
          //   }
          // }

          Message.success(`成功导入模型 "${modelData.name}"`)
          fetchModels(true) // 刷新列表
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
</script>

<style lang="less" scoped>
.data-container {
  .operation-bar {
    padding: 16px 16px 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .model-list {
    width: 100%;
    min-height: 200px;
    height: calc(100vh - 112px);
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 16px 16px 16px;
    .empty-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 400px;
      background-color: var(--color-bg-2);
      border-radius: var(--border-radius-small);
      border: 1px dashed var(--color-border-2);

      :deep(.arco-empty) {
        padding: 40px;

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;

          .icon-bg {
            width: 96px;
            height: 96px;
            border-radius: 48px;
            background: linear-gradient(180deg, var(--color-fill-2) 0%, var(--color-fill-3) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 20px rgba(var(--primary-6), 0.1);

            .icon {
              font-size: 40px;
              color: rgb(var(--primary-6));
              opacity: 0.8;
            }
          }
        }

        .empty-desc {
          color: var(--color-text-3);
          font-size: 14px;
          margin: 0 0 24px;
        }

        .create-btn {
          min-width: 120px;
          height: 40px;
          font-size: 15px;
        }
      }
    }

    .model-card {
      margin-bottom: 16px;
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
      }

      :deep(.arco-card-header) {
        border: none !important;
      }
      .model-header {
        display: flex;
        align-items: center;
        font-size: 18px;
        font-weight: bold;
        .model-icon {
          margin-right: 12px;
        }
      }

      .model-content {
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

        .field-stats {
          padding: 8px;
          font-size: 13px;
          line-height: 1.8;

          .type-stats {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-top: 4px;
          }
        }

        .fields-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;

          .no-fields {
            color: var(--color-text-3);
            font-size: 13px;
            font-style: italic;
          }

          :deep(.arco-tag) {
            margin: 0;
          }
        }
      }

      .model-info {
        flex-direction: row;
        display: flex;
        justify-content: space-between;
        color: var(--color-text-3);
        font-size: 12px;
        margin-top: 12px;

        .model-stats {
          display: flex;
          gap: 16px;
          margin: 8px 0;

          .stat-item {
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--color-text-2);
            font-size: 13px;

            .icon {
              font-size: 14px;
              color: var(--color-text-3);
            }

            .info-icon {
              font-size: 12px;
              margin-left: 4px;
              color: var(--color-text-3);
              cursor: pointer;

              &:hover {
                color: rgb(var(--primary-6));
              }
            }
          }
        }
        .info-item {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--color-text-3);

          .icon {
            font-size: 14px;
          }
        }
      }
    }
  }

  .fields-config {
    :deep(.arco-table) {
      .arco-table-th {
        background-color: var(--color-fill-2);
      }

      .arco-table-tr:hover {
        td {
          background-color: var(--color-fill-2);
        }
      }

      .arco-input-wrapper,
      .arco-select {
        width: 100%;
      }
    }
  }
}
:deep(.arco-table-cell) {
  padding: 8px 1px;
}
</style>
