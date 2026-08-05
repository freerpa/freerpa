<template>
  <div
    class="custom-node scrollbar"
    :class="{
      selected: selected,
      'status-running': nodeStatus === 'running' || nodeStatus === 'retrying',
      'status-success': nodeStatus === 'success',
      'status-error': nodeStatus === 'error'
    }"
  >
    <!-- Toolbar -->
    <NodeToolbar
      v-if="!isExecuting && !data?.deactivate"
      :node-definition="nodeDefinition"
      :global="data?.global"
      :disabled="data?.deactivate"
      :is-executing="isExecuting"
      :show-detail="nodeDefinition.subFlow && data?.workFlow?.store"
      @action="actionSelect"
    />

    <!-- Deactivate overlay -->
    <div v-if="data.deactivate" class="deactivate">
      <b>节点已停用（停用后不再执行）</b>
      <a-button
        size="small"
        type="primary"
        @click="data.deactivate = false"
        :disabled="isExecuting || isPreview"
      >
        <template #icon><icon-check-circle /></template>
        启用节点
      </a-button>
    </div>

    <!-- Flow handles (prev/next/next-false) -->
    <FlowHandles
      :id="props.id"
      :node="nodeDefinition"
      @showQuickConnect="$emit('showQuickConnect', $event)"
      @addNode="$emit('addNode', $event)"
    />

    <!-- Node header -->
    <NodeHeader
      :id="props.id"
      :icon="data.icon"
      :name="data.name"
      :node-definition="nodeDefinition"
      :rename-mode="renameMode"
      :node-name="nodeName"
      :name-error="checkNodeName(nodeName)"
      :node-status="nodeStatus"
      :err-msg="errMsg"
      :debug-infos="debugInfos"
      :show-debug="debug"
      :icon-style="data.type === 'workflowIf' ? 'transform: rotate(90deg)' : ''"
      @action="actionSelect"
      @save-name="saveNodeName"
      @update:node-name="nodeName = $event"
      @clear-debug="debugInfos = []"
    >
    </NodeHeader>

    <!-- Node content body -->
    <div class="node-content" :class="{ 'has-missing-overlay': nodeDefinition._placeholder }">
      <!-- 占位节点：缺少本地插件白色遮罩 -->
      <div v-if="nodeDefinition._placeholder" class="node-missing-overlay">
        <div class="missing-box">
          <div class="missing-title">插件缺失：{{ missingPluginName }}</div>
          <div class="missing-meta">插件标识：{{ missingPluginId }}</div>
          <div class="missing-meta">插件版本：{{ missingPluginVersion }}</div>
          <div class="missing-action">
            请安装对应插件后重试
            <a-link class="missing-link" @click="goInstall">去安装</a-link>
          </div>
        </div>
      </div>

      <!-- I/O section -->
      <NodeIOSection
        v-if="nodeInputs.length || nodeOutputs.length"
        :node-id="props.id"
        :node-inputs="nodeInputs"
        :node-outputs="nodeOutputs"
        :is-executing="isExecuting"
        :pending-connection="pendingConnection"
        :validate-connection="validateConnection"
        :need-connects="flowStore.needConnects"
      />

      <!-- Quick config -->
      <div class="quick-config" :class="{ preview: isPreview }" v-if="quickConfigFields.length">
        <FieldRenderer
          ref="quickConfigRef"
          v-model="nodeConfig"
          :fields="quickConfigFields"
          :disabled="isExecuting"
          :is-quick-config="true"
        />
      </div>

      <!-- Node view (async component) -->
      <div
        class="execute-view no-wheel no-drag no-pan"
        :class="{ preview: isPreview }"
        v-if="nodeView"
      >
        <component
          :is="nodeView"
          :node="{ id: props.id, ...props.data }"
          :node-status="nodeStatus"
          ref="nodeViewRef"
        />
      </div>
    </div>

    <!-- Sub-flow toggle -->
    <SubFlowToggle
      :is-allow-expand="isAllowExpand"
      :is-executing="isExecuting"
      :sub-flow-expand="props.data.subFlowExpand"
      :sub-flow-name="nodeDefinition.subFlow?.name || ''"
      @toggle="toggleSubFlow(props.id + '-subFlow')"
    />

    <!-- Node resizer -->
    <NodeResizer
      v-if="nodeDefinition.resizable"
      :min-width="nodeDefinition?.size?.width || 300"
      :min-height="nodeDefinition?.size?.height || 30"
      @resize="handleResize"
    />
    <div v-if="nodeDefinition.resizable" class="node-resizer"></div>
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  ref,
  inject,
  provide,
  onUnmounted
} from 'vue'
import { IconCheckCircle, IconExclamationCircle } from '@arco-design/web-vue/es/icon'
import { NodeResizer } from '@vue-flow/node-resizer'
import { useFlowStore } from '../../store'
import { storeToRefs } from 'pinia'
import { ConnectionRules } from '../../utils'
import { useStore } from '@/store'

// Sub-components
import FlowHandles from './components/FlowHandles.vue'
import NodeToolbar from './components/NodeToolbar.vue'
import NodeHeader from './components/NodeHeader.vue'
import NodeIOSection from './components/NodeIOSection.vue'
import SubFlowToggle from './components/SubFlowToggle.vue'
import FieldRenderer from '../fieldRenderer/FieldRenderer.vue'

// Composables
import { useNodeConfig } from './composables/useNodeConfig'
import { useNodeIO } from './composables/useNodeIO'
import { useNodeActions } from './composables/useNodeActions'
import { useNodeEvents } from './composables/useNodeEvents'
import { useSubFlow } from './composables/useSubFlow'

// ── Injections ──────────────────────────────────
const workflowId = inject('workflowId')
const isExecuting = inject('isExecuting')
const isPreview = inject('isPreview')
const pendingConnection = inject('pendingConnection')
const flowStore = useFlowStore(workflowId)
const { debug } = storeToRefs(flowStore)
const { validateConnection } = new ConnectionRules(workflowId)

// ── Props & emits ───────────────────────────────
const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits([
  'addNode',
  'action',
  'addNodeToSubFlow',
  'showQuickConnect',
  'openWorkflowDetail'
])

// ── Provides ────────────────────────────────────
provide('storeScene', 'nodeDetail')
provide('nodeData', props.data)
provide('nodeId', props.id)

// ── Composables ─────────────────────────────────
const {
  nodeDefinition,
  nodeConfig,
  allConfigFieldsWithGroup,
  quickConfigFields,
  quickConfigRef,
  setupConfigWatchers
} = useNodeConfig(props, flowStore, isPreview)

const { nodeInputs, nodeOutputs, setupEdgeValidation } = useNodeIO(
  props, flowStore, nodeDefinition, allConfigFieldsWithGroup
)

const {
  renameMode,
  nodeName,
  checkNodeName,
  saveNodeName,
  actionSelect
} = useNodeActions(props, flowStore, emit)

const nodeViewRef = ref(null)
const { nodeStatus, errMsg, debugInfos, setupEngineLifecycle } = useNodeEvents(
  props, workflowId, flowStore, nodeViewRef, debug
)

const { isAllowExpand, toggleSubFlow } = useSubFlow(props, flowStore, nodeDefinition, isExecuting)

// ── Setup watchers & lifecycle ──────────────────
setupConfigWatchers()
setupEdgeValidation(validateConnection)
setupEngineLifecycle()

// ── Node view async component ──────────────────
const nodeView = computed(() => {
  if (nodeDefinition.view) {
    // 使用节点自身保存的版本号加载 view.vue，而非注册表中的最新版本
    const version = props.data.version || 'V1'
    return defineAsyncComponent(() => import(`@nodes-path/${nodeDefinition.type}/${version}/view.vue`))
  }
  return null
})

// ── Resize handler ──────────────────────────────
const handleResize = (event) => {
  const { width, height } = event.params
  if (nodeViewRef.value?.onNodeResize) {
    nodeViewRef.value.onNodeResize({ width, height })
  }
}

// ── 占位节点：缺失插件信息（取自创建时保存的 config 隐藏字段） ──
// 插件名称优先取保存的原插件名（config._pluginName），而非用户改过的节点名
const missingPluginName = computed(() => {
  const c = props.data.config || {}
  return c._pluginName || props.data.name || props.data.type
})
const missingPluginVersion = computed(() => (props.data.config || {})._pluginVersion || '未知')
const missingPluginId = computed(() => {
  const type = props.data.type || ''
  return type.startsWith('plu_') ? type.slice(4) : type
})

// 去安装：打开设置中心-本地插件页
const goInstall = () => {
  window.dispatchEvent(new CustomEvent('open-settings-center', { detail: { tab: 'plugin' } }))
}

// ── Cleanup ─────────────────────────────────────
onUnmounted(() => {
  flowStore.nodeRefs.delete(props.id)
})
</script>

<style lang="less" scoped>
.node-error-msg {
  padding: 10px;
  background: rgb(var(--red-1));
  border-radius: var(--border-radius-small);
  user-select: text;
}

.custom-node {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: fit-content;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-small);
  cursor: pointer;
  overflow: auto;
  overflow-x: hidden;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);

    .toggleSubFlow {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .quick-config {
      display: block !important;
    }

    :deep(.node-toolbar-box) {
      display: block;
    }
  }

  &.selected {
    border-color: rgb(var(--primary-6)) !important;
    box-shadow: 0 4px 8px rgba(var(--primary-6), 0.2) !important;

    .quick-config {
      display: block !important;
    }

    :deep(.toggleSubFlow) {
      border-color: rgb(var(--primary-6)) !important;
      box-shadow: 0 4px 8px rgba(var(--primary-6), 0.2) !important;

      &::before {
        background: rgb(var(--primary-6)) !important;
      }
    }
  }

  .deactivate {
    position: absolute;
    width: calc(100% - 2px);
    height: calc(100% - 2px);
    background: rgba(255, 255, 255, 0.8);
    z-index: 99;
    border-radius: var(--border-radius-small);
    display: flex;
    gap: 16px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .node-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;

    // 占位节点：遮罩提示需要撑起内容区高度，避免提示信息被裁剪
    &.has-missing-overlay {
      min-height: 140px;
    }

    .quick-config {
      padding: 6px;
      border-top: 1px dashed var(--color-border);
      cursor: default;

      &.preview {
        :deep(.arco-form-item-wrapper-col) {
          filter: blur(3px);

          &::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
          }
        }
      }
    }

    .execute-view {
      flex: 1;
      padding: 6px;
      border-top: 1px dashed var(--color-border);
      overflow: hidden;

      &.preview {
        :deep(.arco-form-item-wrapper-col) {
          filter: blur(3px);

          &::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
          }
        }
      }
    }

  // 占位节点（缺少本地插件）白色遮罩
  .node-missing-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: rgba(255, 255, 255, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;

    .missing-box {
      width: 100%;
      text-align: left;
      font-size: 12px;
      color: var(--color-text-2);
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 14px;
      background: rgba(255, 77, 79, 0.08);
      border: 1px solid rgb(var(--danger-5));
      border-radius: var(--border-radius-small);

      .missing-title {
        font-weight: 700;
        font-size: 13px;
        color: rgb(var(--danger-6));
        margin-bottom: 2px;
      }

      .missing-meta {
        color: var(--color-text-2);
      }

      .missing-action {
        margin-top: 6px;
        color: var(--color-text-3);

        .missing-link {
          margin-left: 4px;
        }
      }
    }
  }
}

  // Execution status styles
  &.status-running {
    border-color: rgb(var(--warning-6));

    &::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      border: 2px solid rgb(var(--warning-6));
      border-radius: 4px;
      animation: border-flow 1s linear infinite;
    }
  }

  &.status-success {
    border-color: rgb(var(--success-6));
  }

  &.status-error {
    border-color: rgb(var(--danger-6));
  }
}

@keyframes border-flow {
  0%   { clip-path: inset(0 0 95% 0); }
  25%  { clip-path: inset(0 0 0 95%); }
  50%  { clip-path: inset(95% 0 0 0); }
  75%  { clip-path: inset(0 95% 0 0); }
  100% { clip-path: inset(0 0 95% 0); }
}

:deep(.react-flow__edge-path) {
  stroke-width: 2px;

  &[data-type='flow'] {
    stroke-width: 3px;
    stroke: rgb(var(--primary-6));
  }
}

.node-resizer {
  position: absolute;
  width: 8px;
  height: 8px;
  border-bottom: 1px solid #000;
  bottom: 0px;
  right: 0px;
  border-right: 1px solid #000;
  border-bottom-right-radius: var(--border-radius-small);
  pointer-events: none;

  &:before {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    border-top: 1px solid #000;
    pointer-events: none;
    transform: translate(-50%, -50%) rotate(135deg);
  }

  &:after {
    content: '';
    position: absolute;
    width: 3px;
    height: 12px;
    border-top: 1px solid #000;
    pointer-events: none;
    transform: translate(-50%, -50%) rotate(135deg);
  }
}
</style>
