<template>
  <div class="comment-node" :class="{ selected: selected }">
    <a-textarea
      ref="textareaRef"
      class="comment-textarea no-wheel no-drag"
      v-model="data.comment"
      spellcheck="false"
      placeholder="请输入注释"
      @change="handleChange"
      @keydown.stop
      @keyup.stop
    />
    <div class="comment-node-mask" v-if="!canEdit" @click="handleClick"></div>

    <NodeResizer />
  </div>
</template>

<script setup>
import { defineProps, inject, computed, ref, watch } from 'vue'
import { NodeResizer } from '@vue-flow/node-resizer'
const isExecuting = inject('isExecuting')
const isPreview = inject('isPreview')
import { useFlowStore } from '../../store'
const workflowId = inject('workflowId')
//获取工作流数据
const flowStore = useFlowStore(workflowId)
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
const needEdit = ref(false)

const canEdit = computed(() => {
  return props.selected && !isExecuting.value && needEdit.value
})

const textareaRef = ref(null)

const handleClick = () => {
  if (isPreview.value) {
    return
  }
  if (props.selected) {
    needEdit.value = true
    textareaRef.value.focus()
  }
}
const handleChange = () => {
  flowStore.onNodesChange([
    {
      id: props.id,
      type: 'data'
    }
  ])
}

watch(canEdit, (value) => {
  if (!value) {
    needEdit.value = false
  }
})
</script>

<style lang="less" scoped>
.comment-node {
  min-width: 300px;
  min-height: 210px;
  height: 100%;
  width: 100%;
  background: transparent;
  border: 1px solid rgb(var(--warning-6));
  border-radius: var(--border-radius-small);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  :deep(.arco-textarea-wrapper) {
    color: var(--color-text-2);
    background-color: rgb(var(--warning-1));
    &:focus-within {
      border-color: rgb(var(--warning-6)) !important;
    }
    height: 100%;
    width: 100%;
    textarea {
      height: 100%;
      width: 100%;
      min-width: 298px;
      min-height: 208px;
    }
  }

  &.selected {
    // border-color: rgb(var(--primary-6)) !important;
    box-shadow: 0 4px 8px rgba(var(--primary-6), 0.2) !important;
    .quick-config {
      display: block !important;
    }
  }

  &-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}
</style>
