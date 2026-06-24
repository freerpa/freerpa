<template>
  <a-modal
    v-model:visible="visible"
    :footer="false"
    :mask-closable="false"
    unmount-on-close
    width="80vw"
    :body-style="{ padding: '0 0 20px 0', minHeight: '80vh' }"
    hide-title
    show-close
  >
    <a-button class="close-btn" type="text" @click="visible = false">
      <icon-close />
    </a-button>
    <a-tabs v-model:active-key="activeTab">
      <!-- 我的兑换 -->
      <a-tab-pane key="purchased" title="我的兑换">
        <div class="table-wrapper">
          <a-table
            :data="purchasedList"
            :loading="loadingPurchased"
            :pagination="{
              total: purchasedTotal,
              current: purchasedPage,
              pageSize,
              showTotal: true,
              showJumper: true
            }"
            @page-change="handlePurchasedPageChange"
            :bordered="false"
            stripe
          >
            <template #columns>
              <a-table-column title="插件名称" data-index="name">
                <template #cell="{ record }">
                  <div class="name-cell">
                    <img :src="record.cover || '/default-cover.png'" class="cover" />
                    <span>
                      {{ record.name }} |
                      <a-tag size="mini" bordered color="gray">{{
                        record.only_node ? '节点' : '工作流'
                      }}</a-tag>
                    </span>
                  </div>
                </template>
              </a-table-column>
              <!-- <a-table-column title="描述" data-index="description" /> -->
              <a-table-column title="分类" data-index="category">
                <template #cell="{ record }">
                  <span>{{ record.category_name }}</span>
                </template>
              </a-table-column>
              <a-table-column title="标签" data-index="tags">
                <template #cell="{ record }">
                  <a-space>
                    <a-tag bordered v-for="tag in record.tags" :key="tag" size="small" color="gray">
                      {{ tag }}
                    </a-tag>
                  </a-space>
                </template>
              </a-table-column>
              <a-table-column title="积分" data-index="price">
                <template #cell="{ record }">
                  <span :class="record.price > 0 ? 'price' : 'free'">
                    {{ record.price > 0 ? `${record.price}` : '免费' }}
                  </span>
                </template>
              </a-table-column>
              <!-- <a-table-column
                title="下载量"
                data-index="downloads"
                align="center"
              /> -->
              <a-table-column title="兑换时间" align="center">
                <template #cell="{ record }">
                  {{ formatDate(record.purchased_at) }}
                </template>
              </a-table-column>
              <a-table-column title="操作" align="center" fixed="right">
                <template #cell="{ record }">
                  <a-space>
                    <a-button type="text" @click="handleView(record)"> 查看 </a-button>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </div>
      </a-tab-pane>
      <!-- 我的发布 -->
      <a-tab-pane key="published" title="我的发布">
        <div class="table-wrapper" v-if="userInfo?.developer">
          <a-space align="end" style="width: 100%; justify-content: space-between">
            <a-radio-group v-model="publishedStatus" type="button">
              <a-radio value="1">{{ getStatusText(1) }}</a-radio>
              <a-radio value="0">{{ getStatusText(0) }}</a-radio>
              <a-radio value="2">{{ getStatusText(2) }}</a-radio>
            </a-radio-group>
            <!-- <div class="alert-text">
              已通过的插件编辑后将会产生新的待审核插件，审核通过后将自动替换，不影响已通过的插件。
            </div> -->
            <a-button type="primary" @click="handleEdit(null)">
              <template #icon><icon-plus /></template>
              发布插件
            </a-button>
          </a-space>
          <a-divider :size="0" />
          <a-table
            :data="publishedList"
            :loading="loadingPublished"
            :pagination="{
              total: publishedTotal,
              current: publishedPage,
              pageSize,
              showTotal: true,
              showJumper: true
            }"
            @page-change="handlePublishedPageChange"
            :bordered="false"
            stripe
          >
            <template #columns>
              <a-table-column title="插件名称" data-index="name">
                <template #cell="{ record }">
                  <div class="name-cell">
                    <img :src="record.cover || '/default-cover.png'" class="cover" />
                    <span>
                      {{ record.name }}
                    </span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="插件类型" data-index="only_node">
                <template #cell="{ record }">
                  <a-tag size="mini" v-if="record.only_node" bordered color="gray">节点</a-tag>
                  <a-tag size="mini" v-else bordered color="gray">工作流</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="分类" data-index="category">
                <template #cell="{ record }">
                  <span>{{ record.category_name }}</span>
                </template>
              </a-table-column>
              <a-table-column title="标签" data-index="tags">
                <template #cell="{ record }">
                  <a-space :size="2">
                    <a-tag bordered v-for="tag in record.tags" :key="tag" size="small" color="gray">
                      {{ tag }}
                    </a-tag>
                  </a-space>
                </template>
              </a-table-column>
              <a-table-column title="积分" data-index="price">
                <template #cell="{ record }">
                  <span :class="record.price > 0 ? 'price' : 'free'">
                    {{ record.price > 0 ? `${record.price}` : '免费' }}
                  </span>
                </template>
              </a-table-column>
              <a-table-column title="兑换量" data-index="downloads" align="center" />
              <!-- <a-table-column title="发布时间" align="center">
                <template #cell="{ record }">
                  {{ formatDate(record.create_time) }}
                </template>
              </a-table-column> -->
              <a-table-column title="审核状态" data-index="status" align="center">
                <template #cell="{ record }">
                  <a-space size="mini">
                    <a-tag :color="getStatusColor(record.status)">
                      {{ getStatusText(record.status) }}
                    </a-tag>

                    <a-tooltip v-if="record.status === 2" :content="record.remark">
                      <icon-info-circle size="16" />
                    </a-tooltip>
                  </a-space>
                </template>
              </a-table-column>
              <a-table-column title="上架状态" align="center">
                <template #cell="{ record }">
                  <a-switch
                    v-model="record.workflow_status"
                    @change="handleUpDown(record)"
                    :disabled="record.status !== 1"
                    :checked-value="1"
                    :unchecked-value="0"
                  />
                </template>
              </a-table-column>
              <a-table-column title="操作" align="center" fixed="right">
                <template #cell="{ record }">
                  <a-space :size="1">
                    <a-button v-if="record.status === 1" type="text" @click="handleView(record)">
                      查看
                    </a-button>
                    <a-button type="text" @click="handleEdit(record)"> 编辑 </a-button>
                    <!-- <a-popconfirm
                      v-if="record.status === 0"
                      content="确定要删除这个插件吗？"
                      type="warning"
                      @ok="handleDelete(record)"
                    >
                      <a-button type="text" status="danger"> 删除 </a-button>
                    </a-popconfirm> -->
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </div>
        <div
          v-else
          style="display: flex; justify-content: center; align-items: center; height: 400px"
        >
          <a-space direction="vertical" align="center">
            <a-empty description="您不是开发者，无法发布插件">
              <template #image>
                <icon-exclamation-circle-fill />
              </template>
            </a-empty>
            <a-button type="primary" @click="$emit('service')">申请成为开发者</a-button>
          </a-space>
        </div>
      </a-tab-pane>

      <!-- 我的举报 -->
      <a-tab-pane key="reported" title="我的举报">
        <div class="table-wrapper">
          <a-table
            :data="reportedList"
            :loading="loadingReported"
            :pagination="{
              total: reportedTotal,
              current: reportedPage,
              pageSize,
              showTotal: true,
              showJumper: true
            }"
            @page-change="handleReportedPageChange"
            :bordered="false"
            stripe
          >
            <template #columns>
              <a-table-column title="插件名称" data-index="workflow_name">
                <template #cell="{ record }">
                  <div class="name-cell">
                    <a-typography-paragraph style="margin: 0; width: 100%" :ellipsis="{ rows: 4 }">
                      {{ record.workflow_name }}
                    </a-typography-paragraph>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="举报内容" data-index="content" ellipsis>
                <template #cell="{ record }">
                  <div class="name-cell">
                    <a-typography-paragraph style="margin: 0; width: 100%" :ellipsis="{ rows: 4 }">
                      {{ record.reason }}
                    </a-typography-paragraph>
                  </div>
                </template>
              </a-table-column>
              <!-- <a-table-column title="描述" data-index="description" /> -->
              <a-table-column title="举报时间" data-index="create_time" :width="120">
                <template #cell="{ record }">
                  <span>{{ formatDate(record.create_time) }}</span>
                </template>
              </a-table-column>
              <a-table-column title="举报状态" data-index="status" :width="100">
                <template #cell="{ record }">
                  <a-space>
                    <a-tag :color="getStatusColor(record.status)">
                      {{ getStatusText(record.status) }}
                    </a-tag>
                  </a-space>
                </template>
              </a-table-column>
              <a-table-column title="处理时间" data-index="handle_time" :width="120">
                <template #cell="{ record }">
                  <span v-if="record.handle_time">{{ formatDate(record.handle_time) }}</span>
                  <span v-else>--</span>
                </template>
              </a-table-column>
              <a-table-column title="处理结果" data-index="handle_result">
                <template #cell="{ record }">
                  <a-typography-paragraph style="margin: 0; width: 100%" :ellipsis="{ rows: 4 }">
                    {{ record.handle_result || '--' }}
                  </a-typography-paragraph>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </div>
      </a-tab-pane>
    </a-tabs>
    <!-- 插件详情弹窗 -->
    <WorkflowDetail
      v-model:visible="showDetail"
      :workflow-id="currentWorkflow?.id || ''"
      @success="handleDetailSuccess"
    />

    <!-- 编辑插件弹窗 -->
    <PublishWorkflow
      v-model:visible="showEdit"
      :workflow="currentWorkflow"
      @success="handleEditSuccess"
      v-if="showEdit"
    />
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconExclamationCircleFill, IconPlus } from '@arco-design/web-vue/es/icon'
import {
  IconClose,
  IconEye,
  IconEdit,
  IconPlayCircle,
  IconInfoCircle
} from '@arco-design/web-vue/es/icon'
import dayjs from 'dayjs'
import WorkflowDetail from './WorkflowDetail.vue'
import PublishWorkflow from './PublishWorkflow.vue'

import {
  getMyReports,
  getMyPurchases,
  getMyPublish,
  downStoreWorkflow,
  upStoreWorkflow,
  deleteWorkflow
} from '@/api/workflowStore'

import { useStore } from '@/store'
import { storeToRefs } from 'pinia'
const store = useStore()
const { userInfo } = storeToRefs(store)
const visible = defineModel('visible')

// 状态
const activeTab = ref('purchased')
const pageSize = 10

// 举报列表
const reportedList = ref([])
const reportedTotal = ref(0)
const reportedPage = ref(1)
const loadingReported = ref(false)
// 获取举报的插件
const fetchReported = async () => {
  loadingReported.value = true
  try {
    const result = await getMyReports({
      page: reportedPage.value,
      pageSize
    })
    reportedList.value = result.data
    reportedTotal.value = result.total
  } finally {
    loadingReported.value = false
  }
}

// 处理举报分页变化
const handleReportedPageChange = (page) => {
  reportedPage.value = page
  fetchReported()
}

// 兑换列表
const purchasedList = ref([])
const purchasedTotal = ref(0)
const purchasedPage = ref(1)
const loadingPurchased = ref(false)

// 获取兑换的插件
const fetchPurchased = async () => {
  loadingPurchased.value = true
  try {
    const result = await getMyPurchases({
      page: purchasedPage.value,
      pageSize
    })
    purchasedList.value = result.list
    purchasedTotal.value = result.total
  } catch (error) {
    Message.error('获取兑换记录失败')
  } finally {
    loadingPurchased.value = false
  }
}
// 处理分页变化
const handlePurchasedPageChange = (page) => {
  purchasedPage.value = page
  fetchPurchased()
}

// 发布列表
const publishedList = ref([])
const publishedTotal = ref(0)
const publishedPage = ref(1)
const publishedStatus = ref('1')
const loadingPublished = ref(false)

// 获取发布的插件
const fetchPublished = async () => {
  loadingPublished.value = true
  try {
    const result = await getMyPublish({
      page: publishedPage.value,
      pageSize,
      status: publishedStatus.value
    })
    publishedList.value = result.list
    publishedTotal.value = result.total
  } finally {
    loadingPublished.value = false
  }
}

// 处理发布分页变化
const handlePublishedPageChange = (page) => {
  publishedPage.value = page
  fetchPublished()
}

// 详情和编辑状态
const showDetail = ref(false)
const showEdit = ref(false)
const currentWorkflow = ref(null)

// 查看详情
const handleView = (workflow) => {
  currentWorkflow.value = workflow
  showDetail.value = true
}

// 编辑插件
const handleEdit = (workflow) => {
  currentWorkflow.value = workflow
  showEdit.value = true
}

// 删除插件
const handleDelete = async (workflow) => {
  try {
    await deleteWorkflow({
      id: workflow.id
    })
    Message.success('删除插件成功')
    fetchPublished()
  } catch (error) {
    Message.error('删除插件失败')
  }
}
//上下架插件
const handleUpDown = async (workflow) => {
  if (workflow.workflow_status == 0) {
    // 下架
    try {
      await downStoreWorkflow({
        id: workflow.id
      })
    } catch (error) {
      workflow.workflow_status = 1
    }
  } else {
    // 上架
    try {
      await upStoreWorkflow({
        id: workflow.id
      })
    } catch (error) {
      workflow.workflow_status = 0
    }
  }
}

// 获取状态颜色
const getStatusColor = (status) => {
  const statusMap = {
    0: 'orange', // 待审核
    1: 'green', // 已通过
    2: 'red', // 已拒绝
    3: 'gray' // 已下架
  }
  return statusMap[status] || 'gray'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    0: '待审核',
    1: '已通过',
    2: '已拒绝',
    3: '已下架'
  }
  return statusMap[status] || '未知'
}

// 监听标签页切换
watch(
  [activeTab, publishedStatus],
  ([tab, status]) => {
    if (tab === 'purchased') {
      fetchPurchased()
    } else if (tab === 'published') {
      fetchPublished()
    } else if (tab === 'reported') {
      fetchReported()
    }
  },
  { immediate: true }
)

// 监听弹窗显示
watch(
  () => visible.value,
  async (val) => {
    if (val) {
      // 重置页码
      purchasedPage.value = 1
      publishedPage.value = 1
      // 获取数据
      if (activeTab.value === 'purchased') {
        fetchPurchased()
      } else {
        fetchPublished()
      }
    }
  }
)

// 格式化日期
const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD')
}

// 处理详情操作成功
const handleDetailSuccess = () => {
  fetchPurchased()
  fetchPublished()
}

// 处理编辑成功
const handleEditSuccess = () => {
  fetchPublished()
}
</script>

<style lang="less" scoped>
.table-wrapper {
  padding: 0 16px;
  .alert-text {
    color: var(--color-text-2);
    background-color: var(--color-fill-2);
    padding: 5px 16px;
    border-radius: 2px;
  }
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .cover {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
  }
}

.price {
  color: #ff4d4f;
  font-weight: bold;
}

.free {
  color: #52c41a;
}

:deep(.arco-table-th) {
  background-color: var(--color-fill-2) !important;
}

:deep(.arco-table-tr:hover) {
  td {
    background-color: var(--color-fill-2) !important;
  }
}

:deep(.arco-tabs) {
  .arco-tabs-nav {
    margin-bottom: 0;
  }
}

.close-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  border-radius: var(--border-radius-small);
  height: 32px;
  width: 32px;
  padding: 0;
}
</style>
