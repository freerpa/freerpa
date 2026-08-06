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
      <Background pattern-color="#aaa" gap="20" />
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
const handlePionterUp = (e) => {
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
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-small);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;

  &.selected {
    border-color: rgb(var(--primary-6)) !important;
    box-shadow: 0 4px 8px rgba(var(--primary-6), 0.2) !important;
    .quick-config {
      display: block !important;
    }
  }
  &-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: linear-gradient(to bottom, rgb(var(--primary-1)), #fff);
    border-radius: var(--border-radius-small) var(--border-radius-small) 0 0;
    height: 40px;
    width: 100%;
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text-1);

    &-icon {
      width: 18px;
      height: 18px;
      margin-right: 8px;
      padding: 2px;
      border-radius: var(--border-radius-small);
      border: 1px solid var(--color-text-1);
      transform: rotate(90deg);
    }

    &-title {
      flex: 1;
      font-size: 16px;
      font-weight: bold;
      color: var(--color-text-1);
    }
  }

  &-content {
    top: 30px;
    width: calc(100% - 20px);
    height: calc(100% - 50px);
    background: #f2f3f5;
    margin: 10px;
    position: absolute;
    border-radius: var(--border-radius-small);
  }
}
</style>
