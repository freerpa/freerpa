<template>
  <div class="node-list-container">
    <a-space style="margin-bottom: 6px" direction="vertical" align="center">
      <a-space>
        <a-radio-group type="button" size="small" v-model="activeTab" @change="handleTabChange">
          <a-radio value="system">节点</a-radio>
          <a-radio value="workflow">工作流</a-radio>
          <a-radio value="plugin">插件</a-radio>
        </a-radio-group>
      </a-space>

      <div v-if="activeTab == 'system'" class="search-bar">
        <a-input placeholder="请输入关键字" v-model="systemKeyword" allow-clear size="small">
          <template #prefix><icon-search /></template>
        </a-input>
      </div>

      <div v-if="activeTab == 'workflow'" class="search-bar">
        <a-input placeholder="请输入关键字" v-model="workflowKeyword" allow-clear size="small">
          <template #prepend>
            <CategorySelect @change="handleSelectWorkflowCategory" />
          </template>
          <template #prefix><icon-search /></template>
        </a-input>
      </div>

      <div v-if="activeTab == 'plugin'" class="search-bar">
        <a-input placeholder="请输入关键字" v-model="pluginKeyword" allow-clear size="small">
          <template #prefix><icon-search /></template>
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
                  drag: trigger === 'drag',
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
                    :style="[node.type == 'workflowIf' ? 'transform: rotate(90deg)' : '']"
                  />
                </a-tooltip>
                <span class="node-name">{{ node.name }}</span>
              </div>
            </div>
          </div>
        </a-scrollbar>
      </div>
      <a-tabs v-else position="left" size="medium" class="node-list" v-model:active-key="activeNodeTab">
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
                    drag: trigger === 'drag',
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
                      :style="[node.type == 'workflowIf' ? 'transform: rotate(90deg)' : '']"
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
    <div v-if="activeTab === 'plugin'">
      <div v-if="filteredPlugins.length === 0" class="node-list">
        <a-empty style="margin-top: 100px" description="暂无数据" />
      </div>
      <div v-else class="node-list">
        <a-scrollbar style="width: 100%; height: 400px; overflow: auto">
          <div class="node-group">
            <div class="group-content">
              <div
                v-for="plg in filteredPlugins"
                :key="plg.identifier || plg.pluginId"
                class="node-item"
                :class="{
                  disabled: disabled || !pluginNodeValid(plg),
                  click: trigger === 'click',
                  drag: trigger === 'drag',
                }"
                :draggable="!disabled && trigger === 'drag'"
                @dragstart="(event) => handlePluginDragStart(event, plg)"
                @dragend="dragStartNode = false"
                @click="trigger === 'click' ? handlePluginClick(plg) : null"
              >
                <a-tooltip :content="`${plg.name}（${plg.identifier}）\n${plg.description || ''}`">
                  <RiPlugLine class="node-icon" size="16" />
                </a-tooltip>
                <span class="node-name">
                  {{ plg.name }}
                  <span class="node-ver">{{ plg.version }}</span>
                </span>
              </div>
            </div>
          </div>
        </a-scrollbar>
      </div>
    </div>
    <div class="node-list" v-if="activeTab === 'workflow'">
      <a-empty style="margin-top: 100px" v-if="workflows.length === 0" description="暂无数据" />
      <a-list v-else @reach-bottom="fetchData" :hoverable="false" :split="false" :max-height="400" :bordered="false">
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
            drag: trigger === 'drag',
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
              <a-tag size="small">{{ item.nodes_count }}个节点</a-tag>
            </div>
          </div>
          <a-typography-text class="workflow-item-description" :ellipsis="{ rows: 3 }" style="margin: 0px">
            {{ item.description || '暂无描述' }}
          </a-typography-text>
        </a-list-item>
      </a-list>
    </div>
  </div>
</template>

<script setup>
  import { IconBranch, IconSearch } from '@arco-design/web-vue/lib/icon';
  import { RiPlugLine } from '@remixicon/vue';
  import allNodes, { categories, loadPluginNodes } from '@nodes-path';
  import { debounce } from 'lodash-es';
  import { defineEmits, inject, ref, onMounted, watch, provide, computed } from 'vue';
  import { useFlowStore } from '../store';
  import { storeToRefs } from 'pinia';
  import { getInitNodeData } from '../utils';
  import CategorySelect from '@/components/CategorySelect.vue';
  const { workflow: workflowAPI } = window.electronAPI;
  const workflowId = inject('workflowId');
  const { dragStartNode, activeNodeTab } = storeToRefs(useFlowStore(workflowId));
  const props = defineProps({
    disabled: {
      type: Boolean,
      default: false,
    },
    trigger: {
      type: String,
      default: 'drag',
    },
    type: {
      type: String,
      default: 'add',
    },
  });
  provide('storeScene', 'nodeList');

  const emit = defineEmits(['chooseNode', 'dragStart']);

  const handleClick = async (type, workflowId) => {
    if (props.disabled || !isValid(allNodes[type])) return;
    emit('chooseNode', getInitNodeData(type, workflowId, false));
  };

  const isValid = (node) => {
    let valid = true;
    if (node?.prev === false && props.type === 'add') {
      valid = false;
    } else if ((node?.prev === false || node?.next === false) && props.type === 'insert') {
      valid = false;
    }
    return valid;
  };

  const handleDragStart = async (event, type, workflowId) => {
    if (props.disabled || !isValid(allNodes[type])) return;
    dragStartNode.value = true;
    event.dataTransfer.setData('node', getInitNodeData(type, workflowId, false));
  };

  const activeTab = ref('system');
  const systemKeyword = ref('');
  const workflowKeyword = ref('');
  const searchKeyword = ref('');

  // ═══════════════ 本地插件选项卡 ═══════════════
  const pluginKeyword = ref('');
  const plugins = ref([]);

  const filteredPlugins = computed(() => {
    const kw = pluginKeyword.value.trim();
    if (!kw) return plugins.value;
    return plugins.value.filter((p) => (p.name || '').includes(kw) || (p.description || '').includes(kw));
  });

  const fetchPlugins = async () => {
    // 单次扫描：loadPluginNodes 内部调 plugin.list() 并返回列表，同时完成 plu_ 节点注册/清理
    plugins.value = await loadPluginNodes();
  };

  /**
   * 插件对应的 plu_<插件id> 节点是否有效（已注册且满足增/插位置规则）
   */
  const pluginNodeValid = (plugin) => {
    const identifier =
      plugin.identifier || (plugin.isDev ? `${plugin.pluginId}@dev` : `${plugin.pluginId}@${plugin.version}`);
    const node = allNodes[`plu_${identifier}`];
    return !!node && isValid(node);
  };

  /**
   * 生成 plu_<插件id> 节点数据：
   * 节点定义由 loadPluginNodes() 注册，config 自动携带隐藏的 pluginId（default = 插件 id），
   * 版本号沿用节点规则（_version: 'V1'）
   */
  const createPluginNodeData = (plugin) => {
    // 每版本独立节点：type = plu_pluginId@version
    const identifier =
      plugin.identifier || (plugin.isDev ? `${plugin.pluginId}@dev` : `${plugin.pluginId}@${plugin.version}`);
    return getInitNodeData(`plu_${identifier}`, null, false);
  };

  const handlePluginClick = (plugin) => {
    if (props.disabled || !pluginNodeValid(plugin)) return;
    emit('chooseNode', createPluginNodeData(plugin));
  };

  const handlePluginDragStart = (event, plugin) => {
    if (props.disabled || !pluginNodeValid(plugin)) return;
    dragStartNode.value = true;
    event.dataTransfer.setData('node', createPluginNodeData(plugin));
  };

  const searchNodes = computed(() => {
    return Object.values(allNodes).filter((node) => {
      return node.name.includes(searchKeyword.value);
    });
  });

  watch(
    systemKeyword,
    debounce(() => {
      searchKeyword.value = systemKeyword.value;
    }, 300)
  );

  watch(
    workflowKeyword,
    debounce(() => {
      fetchData(true);
    }, 300)
  );

  onMounted(() => {
    page = 0;
    total = 0;
    fetchPlugins();
  });
  let page = 0;
  let total = 0;
  const isMore = ref(true);
  const workflowCategory = ref(null);
  const handleSelectWorkflowCategory = (value) => {
    workflowCategory.value = value;
    fetchData(true);
  };
  const fetchData = async (isSearch = false) => {
    if (isSearch) {
      page = 1;
      isMore.value = true;
    } else {
      if (!isMore.value) return;
      page++;
    }
    const res = await workflowAPI.getWorkflows({
      page,
      pageSize: 10,
      keyword: workflowKeyword.value,
      category_id: workflowCategory.value,
    });
    total = res.total;
    if (page === 1) {
      workflows.value = res.data;
    } else {
      workflows.value = [...workflows.value, ...res.data];
    }
    if (workflows.value.length >= total) {
      isMore.value = false;
    }
  };

  const workflows = ref([]);

  const handleTabChange = (value) => {
    if (value === 'workflow' && page === 0) {
      fetchData();
    }
    if (value === 'plugin') {
      fetchPlugins();
    }
  };
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
        .node-ver {
          color: var(--color-text-3);
          font-size: 11px;
        }
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
