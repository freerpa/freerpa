<template>
  <div class="node-list-container">
    <a-space style="margin-bottom: 6px" direction="vertical" align="center">
      <a-space>
        <a-radio-group type="button" size="small" v-model="activeTab" @change="handleTabChange">
          <a-radio value="system">系统</a-radio>
          <a-radio value="workflow">工作流</a-radio>
          <a-radio value="store">商店</a-radio>
        </a-radio-group>
      </a-space>

      <div v-if="activeTab == 'system'" class="search-bar">
        <a-input placeholder="请输入关键字" v-model="systemKeyword" allow-clear size="small">
          <template #prefix> <icon-search /> </template>
        </a-input>
      </div>

      <div v-if="activeTab == 'workflow'" class="search-bar">
        <a-input placeholder="请输入关键字" v-model="workflowKeyword" allow-clear size="small">
          <template #prepend>
            <CategorySelect @change="handleSelectWorkflowCategory" />
          </template>
          <template #prefix> <icon-search /> </template>
        </a-input>
      </div>

      <div v-if="activeTab == 'store'" class="search-bar">
        <a-input placeholder="请输入关键字" v-model="storeKeyword" allow-clear size="small">
          <template #prepend>
            <a-dropdown trigger="hover" @select="handleSelectStoreCategory">
              <span style="cursor: pointer">
                {{ storeCategories.find((item) => item.id === storeCategory)?.name || '全部' }}
                <icon-down />
              </span>
              <template #content>
                <a-doption value="">全部</a-doption>
                <a-doption v-for="item of storeCategories" :key="item.id" :value="item.id">
                  {{ item.name }}
                </a-doption>
              </template>
            </a-dropdown>
          </template>
          <template #prefix> <icon-search /> </template>
          <template #append>
            <a-tooltip content="获取更多">
              <span style="cursor: pointer" @click="showStoreWorkflows = true">
                <icon-apps />
              </span>
            </a-tooltip>
          </template>
        </a-input>
      </div>
    </a-space>
    <div v-if="activeTab === 'system'">
      <div v-if="searchKeyword" class="node-list">
        <a-empty v-if="searchNodes.length === 0" description="暂无数据" />
        <a-scrollbar v-else style="width: 100%; height: 400px; overflow: auto">
          <!-- 流程节点 -->
          <div class="node-group">
            <div class="group-content">
              <div
                v-for="node in searchNodes"
                :key="node.type"
                class="node-item"
                :class="{
                  disabled: disabled || !isValid(node),
                  click: trigger === 'click',
                  drag: trigger === 'drag'
                }"
                :draggable="!disabled && trigger === 'drag'"
                @dragstart="(event) => handleDragStart(event, node.type)"
                @dragend="dragStartNode = false"
                @click="trigger === 'click' ? handleClick(node.type) : null"
              >
                <a-tooltip :content="node.description">
                  <component
                    :is="node.icon"
                    class="node-icon"
                    size="16"
                    :style="[node.type == 'logicIf' ? 'transform: rotate(90deg)' : '']"
                  />
                </a-tooltip>
                <span class="node-name">{{ node.name }}</span>
              </div>
            </div>
          </div>
        </a-scrollbar>
      </div>
      <a-tabs
        v-else
        position="left"
        size="medium"
        class="node-list"
        v-model:active-key="activeNodeTab"
      >
        <a-tab-pane :key="category.name" :title="category.name" v-for="category in categories">
          <a-scrollbar style="width: 100%; height: 400px; overflow: auto">
            <!-- 流程节点 -->
            <div class="node-group">
              <div class="group-content">
                <div
                  v-for="node in category.nodes"
                  :key="node.type"
                  class="node-item"
                  :class="{
                    disabled: disabled || !isValid(node),
                    click: trigger === 'click',
                    drag: trigger === 'drag'
                  }"
                  :draggable="!disabled && trigger === 'drag'"
                  @dragstart="(event) => handleDragStart(event, node.type)"
                  @dragend="dragStartNode = false"
                  @click="trigger === 'click' ? handleClick(node.type) : null"
                >
                  <a-tooltip :content="node.description">
                    <component
                      :is="node.icon"
                      class="node-icon"
                      size="16"
                      :style="[node.type == 'logicIf' ? 'transform: rotate(90deg)' : '']"
                    />
                  </a-tooltip>
                  <span class="node-name">{{ node.name }}</span>
                </div>
              </div>
            </div>
          </a-scrollbar>
        </a-tab-pane>
      </a-tabs>
    </div>
    <div class="node-list" v-if="activeTab === 'workflow'">
      <a-empty style="margin-top: 100px" v-if="workflows.length === 0" description="暂无数据" />
      <a-list
        v-else
        @reach-bottom="fetchData"
        :hoverable="false"
        :split="false"
        :max-height="400"
        :bordered="false"
      >
        <template #scroll-loading>
          <a-divider v-if="!isMore">没有更多了</a-divider>
          <a-spin v-else />
        </template>
        <a-list-item
          v-for="item of workflows"
          :grid-props="{ gutter: [20, 20], sm: 24, md: 12, lg: 8, xl: 6 }"
          :key="item.id"
          :bordered="false"
          class="node-item workflow-item"
          :class="{
            disabled: disabled,
            click: trigger === 'click',
            drag: trigger === 'drag'
          }"
          :draggable="!disabled && trigger === 'drag'"
          @dragstart="(event) => handleDragStart(event, 'workFlow', item.id)"
          @dragend="dragStartNode = false"
          @click="trigger === 'click' ? handleClick('workFlow', item.id) : null"
        >
          <div class="workflow-item-header">
            <div class="workflow-item-header-icon">
              <icon-branch />
            </div>
            <div class="workflow-item-header-title">
              <a-typography-text ellipsis style="margin: 0px">
                {{ item.name }}
              </a-typography-text>
              <a-tag size="small"> {{ item.nodes_count }}个节点 </a-tag>
            </div>
          </div>
          <a-typography-text
            class="workflow-item-description"
            :ellipsis="{ rows: 3 }"
            style="margin: 0px"
          >
            {{ item.description || '暂无描述' }}
          </a-typography-text>
        </a-list-item>
      </a-list>
    </div>

    <div class="node-list" v-if="activeTab === 'store'">
      <a-empty
        style="margin-top: 100px"
        v-if="storeWorkflows.length === 0"
        description="暂无数据"
      />
      <a-list
        v-else
        @reach-bottom="fetchStoreData"
        :hoverable="false"
        :split="false"
        :max-height="400"
        :bordered="false"
      >
        <template #scroll-loading>
          <a-divider v-if="!storeIsMore">没有更多了</a-divider>
          <a-spin v-else />
        </template>
        <a-list-item
          v-for="item of storeWorkflows"
          :grid-props="{ gutter: [20, 20], sm: 24, md: 12, lg: 8, xl: 6 }"
          :key="item.id"
          :bordered="false"
          class="node-item workflow-item"
          :class="{
            disabled: disabled,
            click: trigger === 'click',
            drag: trigger === 'drag'
          }"
          :draggable="!disabled && trigger === 'drag'"
          @dragstart="(event) => handleDragStart(event, 'workFlow', item.id, true)"
          @dragend="dragStartNode = false"
          @click="trigger === 'click' ? handleClick('workFlow', item.id, true) : null"
        >
          <div class="workflow-item-header">
            <div class="workflow-item-header-icon">
              <a-avatar :size="24" :image-url="item.cover" shape="square"></a-avatar>
            </div>
            <div class="workflow-item-header-title">
              <a-typography-text ellipsis style="margin: 0px">
                {{ item.name }}
              </a-typography-text>
              <a-tag size="small"> {{ item.nodes_count }}个节点 </a-tag>
            </div>
          </div>
          <a-typography-text
            class="workflow-item-description"
            :ellipsis="{ rows: 2 }"
            style="margin: 0px"
          >
            {{ item.description || '暂无描述' }}
          </a-typography-text>
        </a-list-item>
      </a-list>
    </div>
  </div>
  <a-modal
    v-model:visible="showStoreWorkflows"
    title="插件商店"
    width="1200px"
    :body-style="{ maxHeight: '80vh' }"
    :footer="false"
  >
    <WorkflowStore v-if="showStoreWorkflows" @purchase-success="purchaseSuccess = true" />
  </a-modal>
</template>

<script setup>
import { IconBranch, IconApps, IconSearch, IconDown } from '@arco-design/web-vue/lib/icon'
import allNodes, { categories } from '@nodes-path'
import { debounce } from 'lodash-es'
import { defineEmits, inject, ref, onMounted, watch, provide, computed } from 'vue'
import { useFlowStore } from '../store'
import { storeToRefs } from 'pinia'
import { getInitNodeData } from '../utils'
import WorkflowStore from '@/views/home/components/WorkflowStore.vue'
import CategorySelect from '@/components/CategorySelect.vue'
const { workflow: workflowAPI } = window.electronAPI
const workflowId = inject('workflowId')
const { dragStartNode, activeNodeTab } = storeToRefs(useFlowStore(workflowId))
import { getMyPurchases, getStoreWorkflowCategories } from '@/api/workflowStore'
import { getAppVersion, compareVersion } from '@/utils/version'
const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  trigger: {
    type: String,
    default: 'drag'
  },
  type: {
    type: String,
    default: 'add'
  }
})

provide('storeScene', 'nodeList')

const emit = defineEmits(['chooseNode', 'dragStart'])

const handleClick = async (type, workflowId, isStore = false) => {
  if (props.disabled || !isValid(allNodes[type])) return
  emit('chooseNode', getInitNodeData(type, workflowId, isStore))
}

const isValid = (node) => {
  let valid = true
  if (node?.prev === false && props.type === 'add') {
    valid = false
  } else if ((node?.prev === false || node?.next === false) && props.type === 'insert') {
    valid = false
  }
  return valid
}

const handleDragStart = async (event, type, workflowId, isStore = false) => {
  if (props.disabled || !isValid(allNodes[type])) return
  dragStartNode.value = true
  event.dataTransfer.setData('node', getInitNodeData(type, workflowId, isStore))
}

const activeTab = ref('system')
const systemKeyword = ref('')
const workflowKeyword = ref('')
const storeKeyword = ref('')
const searchKeyword = ref('')

const searchNodes = computed(() => {
  return Object.values(allNodes).filter((node) => {
    return node.name.includes(searchKeyword.value)
  })
})

watch(
  systemKeyword,
  debounce(() => {
    searchKeyword.value = systemKeyword.value
  }, 300)
)

watch(
  workflowKeyword,
  debounce(() => {
    fetchData(true)
  }, 300)
)

watch(
  storeKeyword,
  debounce(() => {
    fetchStoreData(true)
  }, 300)
)

// 工作流商店分类
const storeCategories = ref([])
const storeCategory = ref(null)
const getStoreCategories = async () => {
  if (storeCategories.value.length > 0) return
  const res = await getStoreWorkflowCategories()
  storeCategories.value = res
}

const handleSelectStoreCategory = (value) => {
  storeCategory.value = value
  fetchStoreData(true)
}

// 工作流商店购买成功之后关闭时刷新
const purchaseSuccess = ref(false)

const workflows = ref([])
let page = 0
let total = 0
const isMore = ref(true)
const workflowCategory = ref(null)
const handleSelectWorkflowCategory = (value) => {
  workflowCategory.value = value
  fetchData(true)
}
const fetchData = async (isSearch = false) => {
  if (isSearch) {
    page = 1
    isMore.value = true
  } else {
    if (!isMore.value) return
    page++
  }
  const res = await workflowAPI.getWorkflows({
    page,
    pageSize: 10,
    keyword: workflowKeyword.value,
    category_id: workflowCategory.value
  })
  total = res.total
  if (page === 1) {
    workflows.value = res.data
  } else {
    workflows.value = [...workflows.value, ...res.data]
  }
  if (workflows.value.length >= total) {
    isMore.value = false
  }
}

const storeWorkflows = ref([])
let storePage = 0
let storeTotal = 0
const storeIsMore = ref(true)
const fetchStoreData = async (isSearch = false) => {
  getStoreCategories()
  if (isSearch) {
    storePage = 1
    storeIsMore.value = true
  } else {
    if (!storeIsMore.value) return
    storePage++
  }
  const res = await getMyPurchases({
    page: storePage,
    pageSize: 10,
    keyword: storeKeyword.value,
    category: storeCategory.value
  })
  storeTotal = res.total
  const list = res.list.filter((item) => compareVersion(getAppVersion(), item.app_version) >= 0)
  if (storePage === 1) {
    storeWorkflows.value = list
  } else {
    storeWorkflows.value = [...storeWorkflows.value, ...list]
  }
  if (storeWorkflows.value.length >= storeTotal) {
    storeIsMore.value = false
  }
}

const showStoreWorkflows = ref(false)

watch(showStoreWorkflows, () => {
  let visible = null
  if (showStoreWorkflows.value) {
    visible = true
  } else {
    if (purchaseSuccess.value) {
      purchaseSuccess.value = false
      storeCategory.value = null
      storeKeyword.value = ''
      fetchStoreData(true)
    }
  }
  emit('showStoreWorkflows', visible)
})

onMounted(() => {
  page = 0
  total = 0
  storePage = 0
  storeTotal = 0
})

const handleTabChange = (value) => {
  if (value === 'workflow' && page === 0) {
    fetchData()
  }
  if (value === 'store' && storePage === 0) {
    fetchStoreData()
  }
}
</script>

<style lang="less" scoped>
.node-list-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.node-list {
  height: 400px;
  width: 360px;
  overflow-y: auto;

  .node-group {
    & + .node-group {
      margin-top: 12px;
    }

    .group-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-1);
      margin-bottom: 8px;
    }

    .group-content {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
  }

  .node-item {
    display: flex;
    align-items: center;
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-small);
    transition: all 0.2s;
    &.click {
      cursor: pointer;
    }
    &.drag {
      cursor: move;
    }
    &.disabled {
      opacity: 0.5;
      cursor: no-drop;
    }
    &:hover {
      background: var(--color-fill-2);
    }
    &.workflow-item {
      padding: 0px;
      margin-bottom: 6px;
      height: 100px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: flex-start;
      background: white;
      :deep(.arco-list-item-meta) {
        padding: 0px;
      }
      &:hover {
        border-color: rgb(var(--primary-6));
      }
      .workflow-item-header {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        width: 360px;
        // border-bottom: 1px solid var(--color-border);
        background: linear-gradient(to bottom, rgb(var(--primary-1)), #fff);

        &-icon {
          width: 24px;
          height: 24px;
          margin-right: 8px;
          background: var(--color-fill-2);
          border-radius: var(--border-radius-small);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        &-title {
          flex: 1;
          font-size: 14px;
          font-weight: bold;
          color: var(--color-text-1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          .arco-typography {
            flex: 1;
          }
        }
      }
      .workflow-item-description {
        padding: 0px 12px;
        font-size: 12px;
        color: var(--color-text-2);
      }
    }

    .node-icon {
      font-size: 16px;
      margin-right: 8px;
      color: rgb(var(--primary-6));
    }

    .node-name {
      font-size: 12px;
      color: var(--color-text-2);
    }
  }
}
.search-button {
  position: absolute;
}
.search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 360px;
}
</style>
