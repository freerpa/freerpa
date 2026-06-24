<template>
  <div class="workflow-store">
    <div class="filter-bar">
      <a-space>
        <a-select
          v-model="selectedCategories"
          placeholder="插件分类"
          style="min-width: 200px"
          multiple
          :max-tag-count="2"
          allow-clear
        >
          <a-option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </a-option>
        </a-select>
        <a-input-search
          v-model="keyword"
          placeholder="搜索插件"
          style="width: 300px"
          @press-enter="handleFilter"
          @search="handleFilter"
          allow-clear
        >
          <template v-if="username" #prepend>
            <a-tooltip :content="`搜索作者：${nickname}`">
              <a-tag
                closable
                @close="
                  () => {
                    username = ''
                    nickname = ''
                    handleFilter()
                  }
                "
              >
                <icon-user />
              </a-tag>
            </a-tooltip>
          </template>
        </a-input-search>
        <a-select v-model="sort" style="width: 110px">
          <a-option value="downloads">下载量</a-option>
          <a-option value="price">积分</a-option>
          <a-option value="update_time">发布时间</a-option>
        </a-select>
        <a-select v-model="order" style="width: 80px">
          <a-option value="desc">降序</a-option>
          <a-option value="asc">升序</a-option>
        </a-select>
        <a-button :loading="loading" type="primary" @click="handleFilter">
          <template #icon><icon-search /></template>
          筛选
        </a-button>
      </a-space>
    </div>
    <a-spin style="width: 100%" :loading="loading" tip="加载中...">
      <div class="workflow-list">
        <a-empty style="padding: 200px" v-if="workflows.length === 0" />
        <a-row :gutter="[8, 8]">
          <a-col
            :xs="{ span: 6 }"
            :sm="{ span: 6 }"
            :lg="{ span: 6 }"
            :xl="{ span: 4 }"
            :xxl="{ span: 4 }"
            v-for="workflow in workflows"
            :key="workflow.id"
          >
            <a-card
              class="workflow-card"
              :body-style="{ padding: '0px' }"
              hoverable
              @click="handleWorkflowClick(workflow)"
            >
              <div class="workflow-cover">
                <a-image
                  :preview="false"
                  width="100%"
                  fit="cover"
                  show-loader
                  :src="workflow.cover + '?imageView2/1/w/200/h/200' || '/default-cover.png'"
                />
                <div class="workflow-stats">
                  <span class="downloads"> <icon-download /> {{ workflow.downloads }} </span>
                  <span class="price">
                    {{ workflow.price > 0 ? `${workflow.price} 积分` : '免费' }}
                  </span>
                </div>
              </div>
              <div class="workflow-info">
                <div class="title">
                  <a-tooltip :content="'插件类型：' + (workflow.only_node ? '节点' : '工作流')">
                    <IconBranch v-if="!workflow.only_node" />
                    <IconCommon v-else />
                  </a-tooltip>
                  <a-typography-paragraph class="name" :ellipsis="{ rows: 1 }">
                    &nbsp;<span>{{ workflow.name }}</span>
                  </a-typography-paragraph>
                </div>

                <a-typography-paragraph class="description" :ellipsis="{ rows: 2 }">
                  {{ workflow.description }}
                </a-typography-paragraph>
                <!-- <a-space>
                  <a-avatar :size="16" :image-url="workflow.author_info.avatar" />
                  <a-typography-paragraph style="margin: 0px" :ellipsis="{ rows: 1 }">
                    {{ workflow.author_info.nickname }}
                  </a-typography-paragraph>
                </a-space> -->
              </div>
            </a-card>
          </a-col>
        </a-row>
      </div>

      <div class="pagination-wrapper">
        <a-pagination
          v-model:current="workflowPage"
          :total="workflowTotal"
          :page-size="workflowPageSize"
          show-total
          size="small"
          @change="fetchWorkflows"
        />
      </div>
    </a-spin>
  </div>
  <!-- 工作流详情弹窗 -->
  <WorkflowDetail
    v-model:visible="showWorkflowDetail"
    :workflow-id="currentWorkflow?.id || ''"
    @purchase-success="handleWorkflowPurchaseSuccess"
    @author-all-workflow="handleAuthorAllWorkflow"
  />
</template>
<script setup>
import { ref, onMounted } from 'vue'
import {
  IconDownload,
  IconSearch,
  IconUser,
  IconCommon,
  IconBranch
} from '@arco-design/web-vue/es/icon'
import { getStoreWorkflows, getStoreWorkflowCategories } from '@/api/workflowStore'
import { Message } from '@arco-design/web-vue'
import WorkflowDetail from '@/views/home/components/WorkflowDetail.vue'
const workflows = ref([])
// 工作流列表状态
const workflowTotal = ref(0)
const workflowPage = ref(1)
const workflowPageSize = ref(12)
const keyword = ref('')
const sort = ref('downloads')
const order = ref('desc')
const loading = ref(false)
// 分类相关
const categories = ref([])
const selectedCategories = ref([])

// 工作流详情状态
const showWorkflowDetail = ref(false)
const currentWorkflow = ref(null)
// 页面加载时获取数据
onMounted(async () => {
  fetchWorkflows()
  fetchCategories()
})

const emit = defineEmits(['purchase-success'])
// 获取分类列表
const fetchCategories = async () => {
  try {
    const result = await getStoreWorkflowCategories()
    categories.value = result
  } catch (error) {
    console.error('获取分类列表失败:', error)
  }
}

// 获取工作流市场列表
const fetchWorkflows = async () => {
  if (loading.value) return
  try {
    loading.value = true
    const result = await getStoreWorkflows({
      page: workflowPage.value,
      pageSize: workflowPageSize.value,
      keyword: keyword.value,
      sort: sort.value,
      order: order.value,
      category_ids: selectedCategories.value.join(','),
      username: username.value
    })
    workflows.value = result.list
    workflowTotal.value = result.total
  } catch (error) {
    Message.error('获取工作流列表失败')
  } finally {
    loading.value = false
  }
}

// 处理工作流点击
const handleWorkflowClick = async (workflow) => {
  currentWorkflow.value = workflow
  showWorkflowDetail.value = true
}

// 处理工作流操作成功
const handleWorkflowPurchaseSuccess = () => {
  // 刷新工作流列表
  // fetchWorkflows()
  emit('purchase-success')
}
const username = ref('')
const nickname = ref('')
// 处理作者所有工作流
const handleAuthorAllWorkflow = (e) => {
  username.value = e.username
  nickname.value = e.nickname
  // 刷新工作流列表
  handleFilter()
}

// 处理筛选
const handleFilter = () => {
  // 重置页码
  workflowPage.value = 1
  fetchWorkflows()
}
</script>

<style lang="less" scoped>
.workflow-store {
  flex: 1;

  .filter-bar {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .workflow-card {
    cursor: pointer;
    transition: all 0.3s;
    overflow: hidden;
    position: relative;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
    }
    .workflow-cover {
      position: relative;
      overflow: hidden;
      .image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .workflow-stats {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 12px 8px 8px 8px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 30%, transparent);
        color: #fff;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;

        .downloads {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .price {
          font-weight: bold;
        }
      }
    }

    .workflow-info {
      padding: 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 2px;
      .title {
        display: flex;
        align-items: center;
        .name {
          width: 100%;
          margin: 0px;
          font-size: 14px;
          color: var(--color-text-1);
        }
      }
      .description {
        margin: 0;
        font-size: 12px;
        color: var(--color-text-3);
        height: 40px;
      }

      .workflow-tags {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
    }

    .workflow-footer {
      padding: 12px;
      border-top: 1px solid var(--color-border);
    }
  }

  .workflow-list {
    margin-bottom: 16px;
  }

  .pagination-wrapper {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
  }
}
</style>
