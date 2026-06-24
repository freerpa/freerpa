<template>
  <div class="workflow-manager">
    <Category type="workflow" @change="handleCategoryChange" />
    <div class="workflow-manager-content">
      <!-- 顶部操作栏 -->

      <div class="operation-bar">
        <a-space>
          <a-button type="primary" @click="handleCreate">
            <template #icon><icon-plus /></template>
            新建工作流
          </a-button>
          <a-button @click="handleImport">
            <template #icon><icon-import /></template>
            导入工作流
          </a-button>
          <a-button @click="fetchWorkflows(true)" :loading="loading">
            <template #icon><icon-refresh /></template>
            刷新
          </a-button>
          <a-input
            v-model="searchKeyword"
            placeholder="搜索工作流"
            style="width: 300px"
            allow-clear
          >
            <template #prefix><icon-search /></template>
          </a-input>
        </a-space>
      </div>

      <!-- 工作流列表 -->
      <a-spin
        :loading="loading"
        tip="加载中..."
        class="workflow-list scrollbar"
        @scroll="handleScroll"
      >
        <div v-if="workflows.length === 0" class="empty-wrapper">
          <a-empty>
            <p class="empty-text">
              <template v-if="searchKeyword">
                未找到"<span class="keyword">{{ searchKeyword }}</span
                >"相关的工作流
              </template>
              <template v-else>暂无工作流</template>
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
            v-for="(workflow, index) in workflows"
            :key="workflow.id"
            @dblclick="handleEdit(workflow)"
          >
            <a-card class="workflow-card" :bordered="true" hoverable>
              <template #title>
                <div class="workflow-header">
                  <div class="workflow-icon">
                    <icon-branch />
                  </div>
                  <a-typography-text
                    :ellipsis="{
                      showTooltip: true
                    }"
                    :style="{ margin: '0', width: '100%' }"
                  >
                    {{ workflow.name }}
                  </a-typography-text>
                </div>
              </template>
              <template #extra>
                <a-space>
                  <a-dropdown>
                    <a-button style="padding: 0 0px" type="text">
                      <icon-more-vertical />
                    </a-button>
                    <template #content>
                      <a-doption @click="handleEdit(workflow)"> <icon-edit /> 编辑 </a-doption>
                      <a-doption @click="handleCopy(workflow)"> <icon-copy /> 复制 </a-doption>
                      <a-doption
                        :disabled="useFlowStore(workflow.id).workflowStatus === 'running'"
                        @click="handleDelete(workflow, index)"
                      >
                        <icon-delete /> 删除
                      </a-doption>
                      <a-doption @click="handleExport(workflow)">
                        <a-space :size="4"> <vipIcon :size="14" /> 导出 </a-space>
                      </a-doption>
                    </template>
                  </a-dropdown>
                </a-space>
              </template>

              <div class="workflow-content">
                <p class="description">
                  {{ workflow.description || '暂无描述' }}
                </p>
              </div>
              <div class="workflow-info">
                <a-space>
                  <a-tag color="red" size="large" v-if="useFlowStore(workflow.id).noticeNum > 0">
                    {{ useFlowStore(workflow.id).noticeNum }}个通知
                  </a-tag>
                  <a-tag
                    :color="getWorkflowStatusText(workflow.id).color"
                    size="large"
                    :bordered="useFlowStore(workflow.id).workflowStatus === 'running'"
                    :loading="useFlowStore(workflow.id).workflowStatus === 'running'"
                  >
                    {{ getWorkflowStatusText(workflow.id).text }}
                  </a-tag>
                  <a-button type="primary" @click="handleViewWorkflow(workflow)">
                    <icon-branch /> 工作流
                  </a-button>
                </a-space>
              </div>
            </a-card>
          </a-col>
        </a-row>
        <LoadMoreState v-if="workflows.length > 0" :has-more="hasMore" />
      </a-spin>

      <!-- 编辑工作流弹窗 -->
      <WorkflowInfoEditor
        v-model:visible="showWorkflowInfoEditor"
        :model-id="selectedWorkflow?.id"
        @success="handleEditorSuccess"
      />
      <!-- 导出工作流 -->
      <!-- <a-modal
        v-model:visible="showExportWorkflowModal"
        title="导出工作流"
        @before-ok="handleExportWorkflow"
      >
        <div class="export-workflow-content">
          <a-form :model="{}" auto-label-width>
            <a-form-item label="导出类型">
              <a-radio-group v-model="exportWorkflowType">
                <a-radio value="all">所有用户</a-radio>
                <a-radio value="user">指定用户</a-radio>
              </a-radio-group>
              <template #extra>
                <a-tag v-if="exportWorkflowType === 'all'" color="orange">
                  可被随意导入、导出、发布、传播，节点可被跨工作流复制
                </a-tag>
                <a-tag v-else color="blue">
                  仅指定用户可导入，不可导出、发布，节点不可跨工作流复制
                </a-tag>
              </template>
            </a-form-item>
            <a-form-item label="用户账号" v-if="exportWorkflowType === 'user'">
              <a-input v-model="exportWorkflowUserName" placeholder="请输入用户账号（手机号）" />
              <template #extra>
                <a-space direction="vertical" :size="4">
                  <a-tag color="red">
                    指定用户需要收取{{ exportWorkflowFee }}积分，请确保账户有足够的积分
                  </a-tag>
                  <a-tag color="red">确认后积分无法退回，重复导出不会额外收取积分</a-tag>
                </a-space>
              </template>
            </a-form-item>
          </a-form>
        </div>
      </a-modal> -->

      <!-- 依赖列表 -->
      <a-modal v-model:visible="showDependencies" title="依赖列表" width="1000px" :footer="false">
        <a-alert style="margin-bottom: 16px" type="warning">
          说明：导入时如果工作流含有依赖工作流，需要同时兑换未拥有的依赖工作流，已经拥有了的，则不会重复兑换！
        </a-alert>
        <a-table :data="dependencies" :pagination="false">
          <template #columns>
            <a-table-column title="名称" data-index="name" />
            <a-table-column title="描述" data-index="description" />
            <a-table-column title="积分" data-index="price" />
            <a-table-column title="查看" data-index="action" :width="60" align="center">
              <template #cell="{ record }">
                <a-button type="text" @click="handleViewDependency(record)">查看</a-button>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </a-modal>

      <workflow-detail v-model:visible="showWorkflowDetail" :workflowId="detailWorkflowId" />
    </div>
  </div>
</template>

<script setup name="WorkflowManager">
import { ref, watch, h, onActivated, provide } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconMoreVertical,
  IconCopy,
  IconClose,
  IconBranch,
  IconRefresh,
  IconImport,
  IconSearch
} from '@arco-design/web-vue/es/icon'
import WorkflowInfoEditor from './components/WorkflowInfoEditor.vue'
import WorkflowDetail from '../home/components/WorkflowDetail.vue'
import Category from '@/components/Category.vue'
import LoadMoreState from '@/components/LoadMoreState.vue'
import { useFlowStore } from '@/workflow/store'
import {
  getWorkflows,
  deleteWorkflow,
  copyWorkflow,
  exportWorkflow,
  getExportWorkflowFee,
  importWorkflow
} from '@/api/workflow'
import { useStore } from '@/store'
import { debounce } from 'lodash-es'
import { storeToRefs } from 'pinia'

// 数据状态
const workflows = ref([])
const searchKeyword = ref('')
const showWorkflowInfoEditor = ref(false)
const currentPage = ref(1)
const pageSize = 24
const hasMore = ref(true)

// 加载状态
const loading = ref(false)

// 获取工作流列表
const fetchWorkflows = async (refresh = false) => {
  if (refresh) {
    currentPage.value = 1
    hasMore.value = true
  }

  try {
    loading.value = true
    const result = await getWorkflows({
      page: currentPage.value,
      pageSize,
      keyword: searchKeyword.value,
      category: category.value
    })
    if (result.list.length < pageSize) {
      hasMore.value = false
    }
    if (currentPage.value === 1) {
      workflows.value = result.list
    } else {
      workflows.value = [...workflows.value, ...result.list]
    }
  } catch (error) {
    Message.error('获取工作流列表失败')
  } finally {
    loading.value = false
  }
}

// 处理滚动事件
const handleScroll = (e) => {
  const scrollTop = e.target.scrollTop
  const scrollHeight = e.target.scrollHeight
  const clientHeight = e.target.clientHeight
  if (scrollTop >= scrollHeight - clientHeight && hasMore.value) {
    currentPage.value++
    fetchWorkflows()
  }
}

// 编辑器状态
const selectedWorkflow = ref(null)
const store = useStore()
const { openedTabs } = storeToRefs(store)
const switchTab = store.switchTab
const isVip = store.isVip
const vipIcon = store.vipIcon

const getWorkflowStatusText = (workflowId) => {
  const statusText = {
    idle: {
      text: '未执行',
      color: 'gray'
    },
    running: {
      text: '执行中',
      color: 'blue'
    },
    error: {
      text: '执行失败',
      color: 'red'
    },
    success: {
      text: '执行成功',
      color: 'green'
    },
    completed: {
      text: '执行完成',
      color: 'green'
    },
    stopping: {
      text: '停止中',
      color: 'blue'
    },
    stopped: {
      text: '已停止',
      color: 'gray'
    }
  }
  return statusText[useFlowStore(workflowId).workflowStatus]
}

watch(
  searchKeyword,
  debounce(() => {
    fetchWorkflows(true)
  }, 300)
)

// 查看工作流
const handleViewWorkflow = (workflow) => {
  if (!openedTabs.value[workflow.id]) {
    openedTabs.value[workflow.id] = {
      id: workflow.id,
      type: 'workflow',
      name: workflow.name,
      workflow,
      store: storeToRefs(useFlowStore(workflow.id))
    }
  }
  switchTab(workflow.id)
}

// 分类
const category = ref('')
provide('category', category)
// 分类改变
const handleCategoryChange = (val) => {
  const newCategory = val === 'all' ? '' : val
  if (newCategory !== category.value) {
    category.value = newCategory
    fetchWorkflows(true)
  }
}

// 处理创建
const handleCreate = () => {
  selectedWorkflow.value = null
  showWorkflowInfoEditor.value = true
}

// 处理编辑
const handleEdit = (workflow) => {
  selectedWorkflow.value = workflow
  showWorkflowInfoEditor.value = true
}

// 处理复制
const handleCopy = async (workflow) => {
  try {
    await copyWorkflow(workflow.id)
    Message.success('复制成功')
    fetchWorkflows(true)
  } catch (error) {
    Message.error('复制失败')
  }
}

// 处理编辑器回调
const handleEditorSuccess = (workflow) => {
  if (selectedWorkflow.value) {
    selectedWorkflow.value.name = workflow.name
    selectedWorkflow.value.category = workflow.category
    selectedWorkflow.value.description = workflow.description
  }
  showWorkflowInfoEditor.value = true
  fetchWorkflows(true)
}

// 处理删除
const handleDelete = (workflow, index) => {
  Modal.confirm({
    title: '删除确认',
    content: `确认删除"${workflow.name}"吗，删除后无法恢复？`,
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
        await deleteWorkflow(workflow.id)
        Message.success('删除成功')
        workflows.value.splice(index, 1)
      } catch (error) {
        Message.error('删除失败')
      }
    }
  })
}

const showExportWorkflowModal = ref(false)
const exportWorkflowType = ref('all')
const exportWorkflowUserName = ref('')
const exportWorkflowFee = ref(0)
getExportWorkflowFee().then((fee) => {
  exportWorkflowFee.value = fee
})

let workflowInfo = ''

// 处理导出工作流
const handleExport = async (workflow) => {
  if (!isVip()) return
  // showExportWorkflowModal.value = true
  workflowInfo = workflow
  handleExportWorkflow()
}

const showDependencies = ref(false)
const dependencies = ref([])
const detailWorkflowId = ref(null)
const showWorkflowDetail = ref(false)

// 查看工作流详情
const handleViewDependency = (workflow) => {
  detailWorkflowId.value = workflow.id
  showWorkflowDetail.value = true
}

// 收费提示
const showFeeTip = (dependencies) => {
  const dependenciesPrice = dependencies.reduce((acc, curr) => acc + curr.price, 0)
  return new Promise((resolve, reject) => {
    if (dependenciesPrice > 0) {
      Modal.confirm({
        title: '确认导出',
        content: h('div', {}, [
          h('p', {}, [
            '该工作流含有 ',
            h('b', {}, `${dependencies.length} 个`),
            h(
              'a',
              {
                class: 'arco-link arco-link-status-normal',
                onclick: () => {
                  showDependencies.value = true
                }
              },
              `查看`
            ),
            ' 依赖工作流，用户在导入时需要扣除至多 ',
            h('b', {}, `${dependenciesPrice} 积分`),
            ' 用于兑换依赖工作流'
          ]),
          h('p', {}, ['继续导出？'])
        ]),
        width: 400,
        okText: '导出',
        okButtonProps: {
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
        onOk: () => resolve(true)
      })
    } else {
      resolve(true)
    }
  })
}

const handleExportWorkflow = async (done) => {
  if (exportWorkflowType.value === 'user') {
    if (exportWorkflowUserName.value === '') {
      Message.error('请输入用户账号')
      done(false)
      return
    }
  }
  try {
    let workflowData = null
    // 获取工作流完整数据
    try {
      const result = await exportWorkflow(
        workflowInfo.id,
        exportWorkflowType.value,
        exportWorkflowUserName.value
      )
      workflowData = result.data
      dependencies.value = result.dependencies || []
      await showFeeTip(dependencies.value)
    } catch (error) {
      // Message.error('导出失败: ' + error.message)
      console.log('error', error)
      done(false)
      return
    }
    // 转换为二进制数据
    const jsonString = JSON.stringify(workflowData)

    // 创建文件头标识 (AMW\0)
    const header = new Uint8Array([0x41, 0x4d, 0x57, 0x00])

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
    if (exportWorkflowType.value === 'user') {
      link.download = `${workflowInfo.name} - 工作流.amw`
    } else {
      link.download = `${workflowInfo.name} - 工作流.amw`
    }
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    // Message.success('导出成功')
  } catch (error) {
    Message.error('导出失败: ' + error.message)
    done(false)
  }
}

// 收费提示
const showImportFeeTip = (dependencies, dependenciesPrice) => {
  return new Promise((resolve, reject) => {
    if (dependenciesPrice > 0) {
      Modal.confirm({
        title: '确认导入',
        content: h('div', {}, [
          h('p', {}, [
            '该工作流含有 ',
            h('b', {}, `${dependencies.length} 个`),
            h(
              'a',
              {
                class: 'arco-link arco-link-status-normal',
                onclick: () => {
                  showDependencies.value = true
                }
              },
              `查看`
            ),
            ' 您未拥有的依赖工作流 '
          ]),
          h('p', {}, [
            '导入需要扣除 ',
            h('b', {}, `${dependenciesPrice} 积分`),
            ' 用于兑换依赖工作流'
          ]),
          h('p', {}, ['继续导入？'])
        ]),

        width: 400,
        okText: '导入',
        okButtonProps: {
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
        onOk: () => resolve(true)
      })
    } else {
      resolve(true)
    }
  })
}

const handleImport = () => {
  // if (!isVip()) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.amw'

  input.onchange = async (e) => {
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
          fileData[2] !== 0x57 || // 'W'
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

        // 保存工作流
        try {
          const result = await importWorkflow(decompressedData)
          if (result.type === 'confirm') {
            dependencies.value = result.dependencies
            await showImportFeeTip(result.dependencies, result.dependencies_price)
            await importWorkflow(decompressedData, true)
          }
        } catch (error) {
          // throw new Error(error.message)
          return
        }

        Message.success(`导入成功`)
        fetchWorkflows() // 刷新列表
      } catch (error) {
        Message.error('导入失败: ' + error.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  input.click()
}

// 页面激活时刷新数据
onActivated(() => {
  fetchWorkflows()
})
</script>

<style lang="less" scoped>
.workflow-manager {
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
  .workflow-list {
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

    .workflow-card {
      margin-bottom: 16px;
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
      }
      :deep(.arco-card-header) {
        border: none !important;
      }
      .workflow-header {
        display: flex;
        align-items: center;
        font-size: 18px;
        font-weight: bold;

        .workflow-icon {
          margin-right: 12px;

          .icon {
            font-size: 18px;
            color: rgb(var(--primary-6));
          }
        }
      }

      .workflow-content {
        .description {
          color: var(--color-text-3);
          height: 60px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          font-size: 13px;
          line-height: 1.6;
        }
      }

      .workflow-info {
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
}
</style>
