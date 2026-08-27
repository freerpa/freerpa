<template>
  <Transition name="drawer-slide" appear>
    <div v-if="visible" class="node-config-drawer no-wheel no-drag">
      <a-tabs
        v-if="tabGroups.length > 0"
        type="line"
        size="large"
        :destroy-on-hide="false"
        scroll-position="center"
        @keydown="unDoReDoInterceptor"
        @keyup="unDoReDoInterceptor"
      >
        <a-tab-pane
          v-for="group in tabGroups"
          :key="group.name"
          :title="group.name"
        >
          <div class="drawer-content scrollbar">
            <FieldRenderer
              layout="vertical"
              :model-value="nodeConfig"
              @update:model-value="onConfigChange"
              :fields="group.fields"
            />
          </div>
        </a-tab-pane>
      </a-tabs>
      <a-empty v-else description="该节点无可配置项" />
    </div>
  </Transition>
</template>

<script setup>
import { computed, provide } from 'vue'
import FieldRenderer from './fieldRenderer/FieldRenderer.vue'
import { unDoReDoInterceptor } from '../utils'

const props = defineProps({
  visible: Boolean,
  nodeId: { type: String, default: '' },
  nodeData: { type: Object, default: () => ({ config: {} }) },
  allConfigFieldsWithGroup: { type: Object, default: () => ({}) }
})

// Provide context needed by FieldRenderer / ParamRefer
provide('nodeId', props.nodeId)
provide('nodeData', props.nodeData)
provide('storeScene', 'nodeDetail')

// Convert grouped fields into tab-friendly array
const tabGroups = computed(() => {
  return Object.entries(props.allConfigFieldsWithGroup).map(([name, fields]) => ({
    name,
    fields
  }))
})

// Node config model — bound to nodeData.config（写回由 FieldRenderer 的 @update:model-value → onConfigChange 完成）
const nodeConfig = computed(() => props.nodeData?.config || {})

// Write config changes back
const onConfigChange = (value) => {
  if (props.nodeData) {
    props.nodeData.config = value
  }
}
</script>

<style lang="less" scoped>
.node-config-drawer {
  position: absolute;
  // 与会话抽屉（.chat-container）一致：垂直占位 100vh - 150px（顶 70px + 底 80px）、距边 20px、阴影
  top: 30px;
  left: 20px;
  bottom: 80px;
  width: 400px;
  background: var(--color-bg-2);
  border-radius: var(--border-radius-small);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  :deep(.arco-tabs) {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;

    .arco-tabs-content {
      flex: 1;
      overflow: hidden;
      padding: 0;
    }

    .arco-tabs-content-list {
      height: 100%;
    }

    .arco-tabs-pane {
      height: 100%;
    }
  }

  .drawer-content {
    flex: 1;
    padding: 10px;
    overflow-y: auto;
    overflow-x: hidden;
    max-height: 100%;
  }
}

// Slide-in from left
.drawer-slide-enter-active {
  transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1),
              opacity 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.drawer-slide-leave-active {
  transition: transform 0.2s cubic-bezier(0.55, 0, 0.55, 0.2),
              opacity 0.2s cubic-bezier(0.55, 0, 0.55, 0.2);
}
.drawer-slide-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.drawer-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
</style>
