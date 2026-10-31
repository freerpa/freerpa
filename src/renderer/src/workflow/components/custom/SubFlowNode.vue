<template>
  <div
    class="sub-flow-node"
    :class="{ selected: selected || IntersectingNode?.id === id }"
    @drop="handleSubFlowDrop"
  >
    <!-- 子流程连接点 -->
    <Handle id="subFlow" type="source" position="top" :connectable="false" />
    <!-- 流程连接点 -->
    <FlowHandles
      v-if="!node.parentNode"
      :id="id"
      :node="data"
      @showQuickConnect="$emit('showQuickConnect', $event)"
      @addNode="$emit('addNode', $event)"
    />
    <div class="sub-flow-node-header">
      <icon-branch class="sub-flow-node-header-icon" />
      <span class="sub-flow-node-header-title">子流程画布</span>
    </div>
    <div class="sub-flow-node-content no-drag" @pointerdown="handlePointerDown">
      <Background pattern-color="rgba(60, 60, 67, 0.18)" gap="20" />
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, inject, computed } from 'vue'
import { IconBranch } from '@arco-design/web-vue/es/icon'
import { Background } from '@vue-flow/background'
import FlowHandles from './components/FlowHandles.vue'
import { Handle } from '@vue-flow/core'
const workflowId = inject('workflowId')

import { useFlowStore } from '../../store'
const flowStore = useFlowStore(workflowId)
import { storeToRefs } from 'pinia'
const { IntersectingNode } = storeToRefs(flowStore)

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  data: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['addNodeToSubFlow', 'showQuickConnect', 'addNode'])
const node = computed(() => {
  return flowStore.vueFlowRef.getNode(props.id)
})

// 拖放至子流程添加节点
const handleSubFlowDrop = (e) => {
  e.stopPropagation()
  e.preventDefault()
  const position = flowStore.vueFlowRef.screenToFlowCoordinate({
    x: e.clientX,
    y: e.clientY
  })
  emit('addNodeToSubFlow', {
    fromNode: props.id,
    nodeData: e.dataTransfer.getData('node'),
    position
  })
}

let startX = 0
let startY = 0
let isDragging = false
const handlePionterUp = () => {
  isDragging = false
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePionterUp)
}
const handlePointerDown = (e) => {
  startX = e.clientX
  startY = e.clientY
  isDragging = true
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePionterUp)
}

const handlePointerMove = (e) => {
  if (!isDragging) return
  const deltaX = e.clientX - startX
  const deltaY = e.clientY - startY
  flowStore.vueFlowRef.panBy({ x: deltaX, y: deltaY })
  startX = e.clientX
  startY = e.clientY
}
</script>

<style lang="less" scoped>
.sub-flow-node {
  min-width: 360px;
  min-height: 170px;
  height: 100%;
  width: 100%;
  background: rgba(255, 255, 255, 0.88);
  border: var(--mac-hairline) solid rgba(0, 0, 0, 0.1);
  border-radius: var(--mac-radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;

  &.selected {
    border-color: var(--mac-accent) !important;
    box-shadow: 0 0 0 3px var(--mac-accent-soft), var(--mac-shadow-2) !important;
    .quick-config {
      display: block !important;
    }
  }
  &-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: linear-gradient(to bottom, rgba(60, 60, 67, 0.06), rgba(255, 255, 255, 0));
    border-radius: var(--mac-radius-md) var(--mac-radius-md) 0 0;
    height: 40px;
    width: 100%;
    font-size: 14px;
    font-weight: 600;
    color: var(--mac-text);

    &-icon {
      width: 18px;
      height: 18px;
      margin-right: 8px;
      padding: 2px;
      border-radius: var(--mac-radius-xs);
      border: 1px solid var(--mac-text-2);
      transform: rotate(90deg);
    }

    &-title {
      flex: 1;
      font-size: 14px;
      font-weight: 600;
      color: var(--mac-text);
    }
  }

  &-content {
    top: 30px;
    width: calc(100% - 20px);
    height: calc(100% - 50px);
    background: rgba(244, 244, 247, 0.9);
    margin: 10px;
    position: absolute;
    border-radius: var(--mac-radius-sm);
  }
}
</style>
