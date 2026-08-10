<template>
  <div class="sender">
    <div class="input-card">
      <!-- 附件展示区 -->
      <div class="attachments-area" v-if="attachments.length > 0">
        <div
          v-for="(att, index) in attachments"
          :key="index"
          class="ai-attach-chip attachment-item"
          :class="{ 'attachment-item--accent': att.type === 'workflow' }"
        >
          <component :is="attMeta(att.type).icon" :size="12" />
          <span class="attachment-item__name">{{ att.name }}</span>
          <a-button class="attachment-item__del" type="secondary" size="mini" @click="attachments.splice(index, 1)">
            <RiCloseLine :size="12" />
          </a-button>
        </div>
      </div>

      <!-- 输入框 -->
      <textarea
        id="msg-input"
        v-model="inputValue"
        rows="2"
        :placeholder="placeholder"
        @keydown.enter.exact.prevent="handleSend"
        @input="autoResize"
      ></textarea>

      <!-- 底部工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <!-- 模型选择 -->
          <a-select class="model-select" v-model="selectedModel" :options="modelOptions" placeholder="选择模型" />

          <div class="dropup">
            <!-- 添加文件 -->
            <a-button class="ai-icon-btn" type="secondary" title="添加文件" @click="fileInput?.click()">
              <RiAttachmentLine :size="15" />
            </a-button>
            <input ref="fileInput" type="file" multiple class="hidden-input" @change="handleFiles" />
          </div>
          <!-- 引用工作流 -->
          <div class="dropup">
            <a-button class="ai-icon-btn" type="secondary" title="引用工作流" @click.stop="toggleMenu('workflow')">
              <RiFlowChart :size="15" />
            </a-button>
            <ResourcePicker
              v-if="openMenu === 'workflow'"
              class="resource-picker"
              title="工作流"
              :loader="loadWorkflows"
              @pick="(item) => pick('workflow', item)"
            >
              <template #icon><RiFlowChart :size="12" /></template>
            </ResourcePicker>
          </div>

          <!-- 浏览器实例 -->
          <div class="dropup">
            <a-button class="ai-icon-btn" type="secondary" title="选择浏览器" @click.stop="toggleMenu('browser')">
              <RiGlobalLine :size="15" />
            </a-button>
            <ResourcePicker
              v-if="openMenu === 'browser'"
              class="resource-picker"
              title="浏览器实例"
              :loader="loadBrowsers"
              @pick="(item) => pick('browser', item)"
            >
              <template #icon><RiGlobalLine :size="12" /></template>
            </ResourcePicker>
          </div>

          <!-- 数据表 -->
          <div class="dropup">
            <a-button class="ai-icon-btn" type="secondary" title="数据表" @click.stop="toggleMenu('table')">
              <RiDatabase2Line :size="15" />
            </a-button>
            <ResourcePicker
              v-if="openMenu === 'table'"
              class="resource-picker"
              title="数据表"
              :loader="loadTables"
              @pick="(item) => pick('table', item)"
            >
              <template #icon><RiDatabase2Line :size="12" /></template>
            </ResourcePicker>
          </div>

          <!-- 元素集 -->
          <div class="dropup">
            <a-button class="ai-icon-btn" type="secondary" title="元素集" @click.stop="toggleMenu('element')">
              <RiStackLine :size="15" />
            </a-button>
            <ResourcePicker
              v-if="openMenu === 'element'"
              class="resource-picker"
              title="元素集"
              name-key="title"
              :loader="loadElements"
              @pick="(item) => pick('element', item)"
            >
              <template #icon><RiStackLine :size="12" /></template>
            </ResourcePicker>
          </div>
        </div>

        <!-- 发送按钮 -->
        <a-button class="send-btn" type="primary" :disabled="inputValue.trim() === '' && !loading" @click="handleSend">
          <template #icon>
            <RiStopCircleLine v-if="loading" :size="16" />
            <RiSendPlaneFill v-else :size="16" />
          </template>
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, defineProps, defineEmits, onMounted, onUnmounted } from 'vue';
  import {
    RiCloseLine,
    RiAttachmentLine,
    RiFileLine,
    RiFlowChart,
    RiGlobalLine,
    RiDatabase2Line,
    RiStackLine,
    RiStopCircleLine,
    RiSendPlaneFill,
  } from '@remixicon/vue';
  import { getModels } from '@/api/aiModels';
  import { v4 as uuidv4 } from 'uuid';
  import ResourcePicker from './ResourcePicker.vue';

  const props = defineProps({
    placeholder: {
      type: String,
      default: '描述你的需求，Enter 发送，Shift+Enter 换行...',
    },
    loading: {
      type: Boolean,
      default: false,
    },
  });

  const emit = defineEmits(['send', 'cancel']);

  // ---- 输入 ----
  const inputValue = ref('');
  const autoResize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  // ---- 模型选择 ----
  const models = ref([]);
  const selectedModel = ref('');
  const modelOptions = computed(() => {
    const groups = {};
    models.value.forEach((m) => {
      const key = m.providerId;
      if (!groups[key]) {
        groups[key] = { isGroup: true, label: m.providerName, options: [] };
      }
      groups[key].options.push({
        label: m.modelName,
        value: JSON.stringify({ providerId: m.providerId, modelId: m.modelId }),
      });
    });
    return Object.values(groups);
  });

  const loadModels = async () => {
    try {
      const list = (await getModels()) || [];
      models.value = list;
      const current = selectedModel.value;
      if (current && list.some((m) => JSON.stringify({ providerId: m.providerId, modelId: m.modelId }) === current)) {
        return;
      }
      selectedModel.value = list[0] ? JSON.stringify({ providerId: list[0].providerId, modelId: list[0].modelId }) : '';
    } catch (err) {
      console.error('加载模型列表失败:', err);
    }
  };
  loadModels();
  defineExpose({ loadModels });

  let offProvidersChanged = null;
  onMounted(() => {
    offProvidersChanged = window.electronAPI.ai.onProvidersChanged(() => loadModels());
    document.addEventListener('click', closeMenus);
  });
  onUnmounted(() => {
    offProvidersChanged?.();
    document.removeEventListener('click', closeMenus);
  });

  // ---- 附件 ----
  const attachments = ref([]); // [{ type, name, id }]
  const ATTACH_META = {
    file: { icon: RiFileLine, label: '文件' },
    workflow: { icon: RiFlowChart, label: '工作流' },
    browser: { icon: RiGlobalLine, label: '浏览器' },
    table: { icon: RiDatabase2Line, label: '数据表' },
    element: { icon: RiStackLine, label: '元素集' },
  };
  const attMeta = (type) => ATTACH_META[type] || ATTACH_META.file;

  // 文件
  const fileInput = ref(null);
  const handleFiles = (e) => {
    Array.from(e.target.files || []).forEach((file) => {
      attachments.value.push({ type: 'file', name: file.name });
    });
    e.target.value = '';
  };

  // ---- 下拉（数据由 ResourcePicker 按需加载） ----
  const openMenu = ref('');
  const toggleMenu = (key) => {
    openMenu.value = openMenu.value === key ? '' : key;
  };
  const closeMenus = () => {
    openMenu.value = '';
  };

  const listData = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);

  const loadWorkflows = async () => {
    const res = await window.electronAPI.workflow.getWorkflows({ page: 1, pageSize: 100 });
    return listData(res);
  };
  const loadBrowsers = async () => {
    const res = await window.electronAPI.browserLocal.getBrowsers({ page: 1, pageSize: 100 });
    return listData(res);
  };
  const loadTables = async () => {
    const res = await window.electronAPI.data.getModels({ page: 1, pageSize: 100 });
    return listData(res);
  };
  const loadElements = async () => {
    const res = await window.electronAPI.elementSet.getElementSets({ page: 1, pageSize: 100 });
    return listData(res);
  };

  const pick = (type, item) => {
    attachments.value.push({ type, name: item.name || item.title || item.id, id: item.id });
    openMenu.value = '';
  };

  // ---- 发送 ----
  const handleSend = () => {
    if (props.loading) {
      emit('cancel');
      return;
    }
    if (!selectedModel.value) {
      window.alert?.('请先在「设置 → 模型管理」中配置供应商与模型');
      return;
    }
    let model = null;
    try {
      model = JSON.parse(selectedModel.value);
    } catch {
      model = null;
    }
    if (!model?.providerId || !model?.modelId) return;
    const text = inputValue.value.trim();
    if (!text && attachments.value.length === 0) return;

    emit('send', {
      id: uuidv4(),
      model,
      role: 'user',
      content: text,
      attachments: attachments.value.map((a) => ({ ...a })),
    });
    inputValue.value = '';
    attachments.value = [];
  };
</script>

<style scoped lang="less">
  .sender {
    position: relative;
  }

  .input-card {
    background: #fff;
    border: 1px solid #e5e5e8;
    border-radius: var(--border-radius-small);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    &:focus-within {
      border-color: #d1d5db;
    }
  }

  .attachments-area {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 12px 0;
  }

  .attachment-item {
    gap: 6px;
    padding: 4px 8px;
    max-width: 200px;
    .attachment-item__name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .attachment-item__del {
      display: flex;
      align-items: center;
      color: #6b7280;
      padding: 0 4px;
      opacity: 0.6;
      transition: opacity 0.15s ease;
      &:hover {
        opacity: 1;
        color: #ef4444;
      }
    }
    &--accent {
      background: rgba(0, 0, 0, 0.08);
      border-color: rgba(0, 0, 0, 0.2);
    }
  }

  #msg-input {
    width: 100%;
    padding: 12px 16px 6px;
    font-size: 14px;
    color: #111114;
    outline: none;
    resize: none;
    border: none;
    background: transparent;
    line-height: 1.5;
    &::placeholder {
      color: #9ca3af;
    }
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .model-select {
    width: 160px;
    margin-right: 2px;
  }

  .divider {
    width: 1px;
    height: 20px;
    background: #e5e5e8;
    margin: 0 8px;
  }

  .hidden-input {
    display: none;
  }

  // 上拉菜单容器
  .dropup {
    position: relative;
    .resource-picker {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 0;
      width: 240px;
      z-index: 100;
    }
  }

  .send-btn {
    width: 32px;
    height: 32px;
    transition: background 0.15s ease;
    flex-shrink: 0;
    &:hover {
      background: #333333;
      color: #fff;
    }
    &:disabled {
      background: #e5e5e8;
      color: #9ca3af;
    }
  }
</style>
