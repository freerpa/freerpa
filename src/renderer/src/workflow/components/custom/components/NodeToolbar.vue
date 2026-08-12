<template>
  <div
    class="node-toolbar-box"
    v-if="hasTools && !isExecuting && !disabled"
    :style="[alwaysVisible ? { display: 'block' } : {}]"
  >
    <div class="node-toolbar">
      <template v-if="nodeDefinition.type !== 'workflowStart'">
        <template v-if="nodeDefinition.type !== 'workflowEnd'">
          <a-tooltip content="重命名：双击标题可快速编辑">
            <icon-edit @click="$emit('action', 'rename')" />
          </a-tooltip>
          <a-tooltip content="复制节点">
            <icon-copy @click="$emit('action', 'copy')" />
          </a-tooltip>
          <a-tooltip content="停用节点">
            <icon-stop @click="$emit('action', 'deactivate')" />
          </a-tooltip>
        </template>
        <a-tooltip content="删除节点">
          <icon-delete @click="$emit('action', 'delete')" />
        </a-tooltip>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  IconEdit,
  IconCopy,
  IconDelete,
  IconStop
} from '@arco-design/web-vue/es/icon'

defineEmits(['action'])

const props = defineProps({
  nodeDefinition: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
  isExecuting: { type: Boolean, default: false },
  alwaysVisible: { type: Boolean, default: false }
})

// 是否存在可显示的工具：workflowStart 无任何工具（编辑/复制/停用/删除均不展示），不渲染空工具栏
const hasTools = computed(() => props.nodeDefinition.type !== 'workflowStart')
</script>

<style lang="less" scoped>
.node-toolbar-box {
  display: none;
  height: 32px;
  position: absolute;
  top: -30px;
  width: 100%;
  z-index: 1000;
  left: 0;
}
.node-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  height: 32px;
  font-weight: bold;
  font-size: 14px;
  color: var(--color-text-1);
  background: rgba(255, 255, 255, 0.3);
  height: 24px;
  padding: 0 12px;
  border-radius: var(--border-radius-small);
  border: 1px solid var(--color-border);
}
</style>
