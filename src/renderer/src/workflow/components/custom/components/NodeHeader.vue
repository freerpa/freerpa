<template>
  <div class="node-header">
    <!-- Custom icon -->
    <a-avatar
      v-if="icon"
      :image-url="icon"
      :size="18"
      shape="square"
      class="node-icon"
    />

    <!-- Default definition icon with tooltip -->
    <a-tooltip v-else>
      <template #content>
        节点：{{ nodeDefinition.name }} <br />
        <div v-html="'描述：' + (nodeDefinition.description || '').replace(/\n/g, '<br />')"></div>
      </template>
      <component
        title="点击查看节点详情"
        :is="nodeDefinition.icon"
        class="node-icon"
        :style="iconStyle"
      />
    </a-tooltip>

    <!-- Node title -->
    <div class="node-title">
      <a-typography-text
        v-if="!renameMode"
        ellipsis
        style="margin: 0px"
        @dblclick="$emit('action', 'rename')"
      >
        {{ name }}
      </a-typography-text>
      <div v-else class="rename-input-box">
        <a-input
          class="node-name-input no-drag no-wheel"
          @keydown.stop
          @keyup.stop
          :model-value="nodeName"
          @update:model-value="$emit('update:nodeName', $event)"
          :error="nameError"
          @blur="$emit('saveName')"
          @press-enter="$event.target.blur()"
          ref="renameInputRef"
        />
        <div class="rename-tips">同级名称不能重复,仅允许中,英,数,下划线</div>
      </div>
    </div>

    <!-- Node actions area -->
    <div class="node-actions">
      <a-space>
        <!-- Retrying badge -->
        <a-tag v-if="nodeStatus === 'retrying'" size="small" color="red">
          第 {{ errMsg }} 次重试中...
        </a-tag>

        <!-- Error popover -->
        <ModalPopover v-if="errMsg && nodeStatus !== 'retrying'">
          <template #content>
            <div class="node-error-msg">{{ errMsg }}</div>
          </template>
          <div class="exclamation">
            <icon-exclamation-polygon-fill />
          </div>
        </ModalPopover>

        <!-- Debug info -->
        <ModalPopover v-if="showDebug">
          <template #content>
            <DebugInfo :id="id" :data="debugInfos" @clear="$emit('clearDebug')" />
          </template>
          <a-tooltip content="查看调试信息">
            <icon-bug />
          </a-tooltip>
        </ModalPopover>

        <!-- Config panel trigger -->
        <slot name="config-trigger" />
      </a-space>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import {
  IconExclamationPolygonFill,
  IconBug
} from '@arco-design/web-vue/es/icon'
import ModalPopover from '../../ModalPopover.vue'
import DebugInfo from './debugInfo.vue'

defineEmits(['action', 'saveName', 'update:nodeName', 'clearDebug'])

const props = defineProps({
  id: { type: String, required: true },
  icon: { type: String, default: '' },
  name: { type: String, default: '' },
  nodeDefinition: { type: Object, required: true },
  renameMode: { type: Boolean, default: false },
  nodeName: { type: String, default: '' },
  nameError: { type: Boolean, default: false },
  nodeStatus: { type: String, default: 'initializing' },
  errMsg: { type: String, default: '' },
  debugInfos: { type: Array, default: () => [] },
  showDebug: { type: Boolean, default: false },
  iconStyle: { type: [Object, String], default: () => ({}) }
})

// Auto-select input text when entering rename mode
const renameInputRef = ref(null)
watch(() => props.renameMode, (val) => {
  if (val) {
    nextTick(() => {
      renameInputRef.value?.inputRef?.select()
    })
  }
})
</script>

<style lang="less" scoped>
.node-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(to bottom, rgb(var(--primary-1)), #fff);
  border-radius: 2px 2px 0 0;

  .node-icon {
    width: 18px;
    height: 18px;
    margin-right: 8px;
  }

  .node-title {
    flex: 1;
    font-size: 16px;
    font-weight: bold;
    color: var(--color-text-1);
    position: relative;

    .node-name-input {
      height: 25px;
    }

    .rename-tips {
      font-weight: normal;
      position: absolute;
      top: 27px;
      left: 0;
      font-size: 10px;
      background: #fff;
      color: var(--color-text-2);
    }
  }

  .node-actions {
    margin-left: 8px;
    opacity: 1;
    display: flex;
    position: relative;

    .exclamation {
      color: #ff4d4f;
    }
  }
}
</style>
