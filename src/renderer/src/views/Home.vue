<template>
  <div class="home-container scrollbar">
    <!-- Banner区域 -->
    <div class="banner-section">
      <a-carousel
        :style="{ width: '100%', height: '300px' }"
        :autoPlay="true"
        animation-name="card"
        indicator-type="line"
        show-arrow="hover"
        arrow-class="carousel-arrow"
      >
        <a-carousel-item
          v-for="banner in banners"
          :key="banner.id"
          @click="handleBannerClick(banner)"
          class="banner-item"
        >
          <a-image
            :src="banner.image + '?imageView2/1/w/1200/h/300'"
            :preview="false"
            :alt="banner.title"
            width="100%"
            height="100%"
            fit="fill"
          />
          <div class="banner-info">
            <h3>{{ banner.title }}</h3>
          </div>
        </a-carousel-item>
      </a-carousel>
    </div>

    <!-- 内容区域 -->
    <div class="content-section">
      <!-- 系统公告 -->
      <div class="notice-section">
        <a-card
          class="notice-card"
          :bordered="false"
          :body-style="{ padding: '0px 0px' }"
          title="系统公告"
        >
          <template #title>
            <a-space>
              <icon-notification />
              <span>系统公告</span>
            </a-space>
          </template>

          <a-list
            :data="notices"
            :loading="noticeLoading"
            :pagination="{
              total: noticeTotal,
              current: noticePage,
              pageSize: noticePageSize,
              size: 'small'
            }"
            :bordered="false"
            @page-change="handleNoticePage"
          >
            <template #item="{ item }">
              <a-list-item @click="showNoticeDetail(item)">
                <div class="notice-item">
                  <span class="notice-title">{{ item.title }}</span>
                  <span class="notice-time">
                    {{ item.create_time.slice(0, 10) }}
                  </span>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </div>

      <!-- 工作流市场 -->
      <a-card
        class="workflow-market"
        :bordered="false"
        :body-style="{ padding: '15px 0px' }"
        :header-style="{ padding: '15px 0px' }"
        title="插件市场"
      >
        <template #title>
          <a-space>
            <icon-apps />
            <span>插件商店（Store）</span>
          </a-space>
        </template>
        <template #extra>
          <a-space>
            <a-button type="text" @click="showMyWorkflows = true">
              <icon-user />
              我的
            </a-button>
            <a-button type="text" @click="showCustomerService">
              <icon-customer-service />
              客服
            </a-button>
          </a-space>
        </template>
        <WorkflowStore />
      </a-card>
    </div>
    <!-- 公告详情弹窗 -->
    <a-modal
      v-model:visible="showNoticeModal"
      :title="currentNotice?.title"
      @cancel="closeNoticeModal"
      :footer="false"
      width="800px"
      :body-style="{ maxHeight: '800px', overflow: 'auto' }"
    >
      <div class="editor-content-view" v-html="currentNotice?.content"></div>
      <div class="notice-meta">
        <span>发布时间：{{ currentNotice?.create_time }}</span>
      </div>
    </a-modal>

    <!-- 我的工作流弹窗 -->
    <MyWorkflows
      v-model:visible="showMyWorkflows"
      @update:visible="showMyWorkflows = $event"
      @service="showCustomerService"
    />

    <!-- 客服弹窗 -->
    <a-modal v-model:visible="customerServiceVisible" title="客服" :footer="false">
      <div class="editor-content-view" v-html="customerService"></div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  IconApps,
  IconUser,
  IconCustomerService,
  IconNotification
} from '@arco-design/web-vue/es/icon'
import MyWorkflows from './home/components/MyWorkflows.vue'
import WorkflowStore from './home/components/WorkflowStore.vue'
import { getProfile } from '@/api/user'
import { getCustomerService } from '@/api/login'
import { getBanners, getNotices, getNoticeDetail } from '@/api/workflowStore'
import { useStore } from '@/store'
const store = useStore()
const { setUserInfo } = store

onMounted(async () => {
  setUserInfo(await getProfile())
})

const customerService = ref(null)
const customerServiceVisible = ref(false)
const showCustomerService = async () => {
  const result = await getCustomerService()
  customerService.value = result
  customerServiceVisible.value = true
}

// 数据状态
const banners = ref([])
const currentNotice = ref(null)
const showNoticeModal = ref(false)

// 公告列表状态
const notices = ref([])
const noticeLoading = ref(false)
const noticeTotal = ref(0)
const noticePage = ref(1)
const noticePageSize = ref(10)

// 我的工作流状态
const showMyWorkflows = ref(false)

// 获取Banner列表
const fetchBanners = async () => {
  try {
    const result = await getBanners()
    banners.value = result
  } catch (error) {
    // Message.error("获取Banner列表失败")
  }
}

// 显示公告详情
const showNoticeDetail = async (notice) => {
  try {
    const result = await getNoticeDetail({ id: notice.id })
    currentNotice.value = result
    showNoticeModal.value = true
  } catch (error) {
    // Message.error("获取公告详情失败")
  }
}

// 关闭公告详情
const closeNoticeModal = () => {
  showNoticeModal.value = false
  currentNotice.value = null
}

// 处理Banner点击
const handleBannerClick = (banner) => {
  // 根据banner类型处理跳转
  switch (banner.type) {
    case 1: // 通知公告
      showNoticeDetail({ id: banner.target_id })
      break
    case 2: // 工作流
      handleWorkflowClick({ id: banner.target_id })
      break
    case 3: // 外链
      window.electronAPI.shell.openExternal(banner.target_id)
      break
  }
}

// 获取所有公告
const fetchNotices = async () => {
  try {
    noticeLoading.value = true
    const result = await getNotices({
      page: noticePage.value,
      pageSize: noticePageSize.value
    })
    notices.value = result.list
    noticeTotal.value = result.total
  } catch (error) {
    // Message.error("获取公告列表失败")
  } finally {
    noticeLoading.value = false
  }
}

// 处理公告分页
const handleNoticePage = async (page) => {
  noticePage.value = page
  await fetchNotices()
}

// 页面加载时获取数据
onMounted(async () => {
  fetchBanners()
  fetchNotices()
})

</script>

<style lang="less" scoped>
.home-container {
  padding: 16px;
  overflow: auto;
  .banner-section {
    margin-bottom: 16px;
    border-radius: var(--border-radius-small);
    overflow: hidden;
    cursor: pointer;

    .banner-item {
      width: 1200px;
      height: 300px;
      border-radius: var(--border-radius-small);
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .banner-info {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 16px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
        color: #fff;

        h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        p {
          margin: 0;
          font-size: 14px;
          opacity: 0.8;
        }
      }
    }
  }

  .content-section {
    display: flex;
    gap: 16px;

    .notice-section {
      min-width: 300px;
      .notice-card {
        height: 100%;
      }

      .notice-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;

        .notice-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .notice-time {
          color: var(--color-text-3);
          font-size: 12px;
          margin-left: 16px;
        }
      }
    }
    .workflow-market {
      flex: 1;
    }
  }
}

.notice-meta {
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-3);
  font-size: 12px;
}
:deep(.arco-carousel-arrow) {
  .arco-carousel-arrow-left,
  .arco-carousel-arrow-right {
    background-color: rgb(var(--primary-6));
    border-radius: var(--border-radius-small);
  }
  .arco-carousel-arrow-left:hover,
  .arco-carousel-arrow-right:hover {
    background-color: rgb(var(--primary-5));
  }
  .arco-carousel-indicator-wrapper-bottom {
    background: transparent;
  }
}
</style>
