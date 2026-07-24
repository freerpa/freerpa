<template>
  <div class="home-container scrollbar">
    <!-- 快捷创建区 -->
    <div class="section">
      <h3 class="section-title">
        <icon-plus-circle />
        快速创建
      </h3>
      <div class="quick-actions">
        <a-card class="action-card" hoverable @click="$router.push('/workflow')">
          <div class="action-icon" style="background: rgb(var(--primary-1))">
            <ri-flow-chart style="color: rgb(var(--primary-6)); font-size: 28px" />
          </div>
          <div class="action-text">
            <span class="action-name">新建工作流</span>
            <span class="action-desc">创建自动化流程</span>
          </div>
        </a-card>
        <a-card class="action-card" hoverable @click="$router.push('/browser')">
          <div class="action-icon" style="background: rgb(var(--success-2))">
            <ri-chrome-line style="color: rgb(var(--success-6)); font-size: 28px" />
          </div>
          <div class="action-text">
            <span class="action-name">浏览器管理</span>
            <span class="action-desc">管理浏览器环境</span>
          </div>
        </a-card>
        <a-card class="action-card" hoverable @click="$router.push('/data')">
          <div class="action-icon" style="background: rgb(var(--warning-2))">
            <ri-database2-line style="color: rgb(var(--warning-6)); font-size: 28px" />
          </div>
          <div class="action-text">
            <span class="action-name">数据表</span>
            <span class="action-desc">管理本地数据模型</span>
          </div>
        </a-card>
        <a-card class="action-card" hoverable @click="$router.push('/elementSet')">
          <div class="action-icon" style="background: rgb(var(--arcoblue-2))">
            <ri-stack-line style="color: rgb(var(--arcoblue-6)); font-size: 28px" />
          </div>
          <div class="action-text">
            <span class="action-name">元素集</span>
            <span class="action-desc">管理网页元素集合</span>
          </div>
        </a-card>
      </div>
    </div>

    <!-- 最近工作流 -->
    <div class="section">
      <h3 class="section-title">
        <icon-history />
        最近工作流
      </h3>
      <a-spin :loading="workflowLoading">
        <a-empty v-if="recentWorkflows.length === 0 && !workflowLoading" description="暂无工作流" />
        <div v-else class="workflow-grid">
          <a-card
            v-for="wf in recentWorkflows"
            :key="wf.id"
            class="workflow-card"
            hoverable
            @click="openWorkflow(wf)"
          >
            <div class="workflow-card-top">
              <ri-flow-chart style="font-size: 20px; color: rgb(var(--primary-6))" />
              <span class="workflow-name">{{ wf.name }}</span>
            </div>
            <div class="workflow-meta">
              <a-tag size="small" color="gray">{{ wf.updated_at?.slice(0, 10) || '--' }}</a-tag>
            </div>
          </a-card>
        </div>
      </a-spin>
    </div>

    <!-- 系统状态 -->
    <div class="section">
      <h3 class="section-title">
        <icon-info-circle />
        系统状态
      </h3>
      <a-row :gutter="16">
        <a-col :span="8">
          <a-card :bordered="false" class="status-card">
            <div class="status-label">浏览器内核</div>
            <div class="status-value">{{ kernelInfo }}</div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card :bordered="false" class="status-card">
            <div class="status-label">数据库路径</div>
            <div class="status-value status-small">{{ dbInfo }}</div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card :bordered="false" class="status-card">
            <div class="status-label">本地插件</div>
            <div class="status-value">{{ pluginCount }} 个</div>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  IconPlusCircle,
  IconHistory,
  IconInfoCircle
} from '@arco-design/web-vue/es/icon'
import {
  RiFlowChart,
  RiChromeLine,
  RiDatabase2Line,
  RiStackLine
} from '@remixicon/vue'
import { useStore } from '@/store'

const store = useStore()
const { switchTab } = store

const recentWorkflows = ref([])
const workflowLoading = ref(false)
const kernelInfo = ref('未知')
const dbInfo = ref('默认位置')
const pluginCount = ref(0)

const fetchRecentWorkflows = async () => {
  try {
    workflowLoading.value = true
    const res = await window.electronAPI.workflow.getWorkflows({
      page: 1,
      pageSize: 8
    })
    recentWorkflows.value = res.data || []
  } catch (_) {
    // 静默失败
  } finally {
    workflowLoading.value = false
  }
}

const fetchKernelInfo = async () => {
  try {
    const list = await window.electronAPI.env.getKernelList()
    kernelInfo.value = list?.length ? `${list.length} 个版本可用` : '暂无'
  } catch (_) {
    kernelInfo.value = '获取失败'
  }
}

const fetchDbInfo = async () => {
  try {
    const info = await window.electronAPI.dbInfo.getInfo()
    dbInfo.value = info?.path || '默认位置'
  } catch (_) {
    dbInfo.value = '默认位置'
  }
}

const fetchPluginCount = async () => {
  try {
    const plugins = await window.electronAPI.plugin.list()
    pluginCount.value = plugins?.length || 0
  } catch (_) {
    pluginCount.value = 0
  }
}

const openWorkflow = (wf) => {
  // 打开工作流编辑器 tab
  if (!store.openedTabs[wf.id]) {
    store.openedTabs[wf.id] = {
      id: wf.id,
      name: wf.name,
      type: 'workflow',
      visible: true
    }
  }
  switchTab(wf.id)
}

onMounted(() => {
  fetchRecentWorkflows()
  fetchKernelInfo()
  fetchDbInfo()
  fetchPluginCount()
})
</script>

<style lang="less" scoped>
.home-container {
  padding: 24px;
  overflow: auto;
  height: 100%;
}

.section {
  margin-bottom: 32px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-1);
    margin-bottom: 16px;
  }
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  .action-card {
    :deep(.arco-card-body) {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
    }

    .action-icon {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .action-text {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .action-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--color-text-1);
      }

      .action-desc {
        font-size: 12px;
        color: var(--color-text-3);
      }
    }
  }
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  .workflow-card {
    .workflow-card-top {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;

      .workflow-name {
        font-size: 14px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.status-card {
  .status-label {
    font-size: 13px;
    color: var(--color-text-3);
    margin-bottom: 8px;
  }

  .status-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-1);
  }

  .status-small {
    font-size: 13px;
  }
}
</style>
