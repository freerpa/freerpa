<template>
  <BaseEdge
    :id="id"
    :style="{ ...style, ...strokeStyle }"
    :path="path[0]"
    :marker-end="markerEnd"
  />
  <EdgeLabelRenderer>
    <div
      tabindex="0"
      :style="{
        pointerEvents: 'all',
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${path[1]}px,${path[2]}px)`
      }"
      class="nodrag nopan"
      :class="{ selected: selected }"
      @focus="addBtnShow = true"
      @mouseenter="addBtnShow = true"
      @mouseleave="!nodeListVisible && (addBtnShow = false)"
    >
      <div
        class="add-btn"
        v-if="
          !isExecuting &&
          ['next', 'next-false'].includes(sourceHandleId) &&
          targetHandleId === 'prev' &&
          (hoverEdgeId == id || addBtnShow)
        "
        @click="
          emit('showQuickConnect', {
            e: $event,
            edgeId: id
          })
        "
      >
        <IconPlus />
      </div>
      <!-- <div v-else>{{ label }}</div> -->
    </div>
  </EdgeLabelRenderer>
</template>
<script setup>
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath } from '@vue-flow/core'
import { computed, inject, ref, watch } from 'vue'
import { IconPlus } from '@arco-design/web-vue/es/icon'
import { useFlowStore } from '../../store'
import { storeToRefs } from 'pinia'
const workflowId = inject('workflowId')
const flowStore = useFlowStore(workflowId)
const { isExecuting } = storeToRefs(flowStore)
const props = defineProps({
  id: {
    type: String,
    required: true
  },
  sourceHandleId: {
    type: String,
    required: true
  },
  targetHandleId: {
    type: String,
    required: true
  },
  sourceX: {
    type: Number,
    required: true
  },
  sourceY: {
    type: Number,
    required: true
  },
  targetX: {
    type: Number,
    required: true
  },
  targetY: {
    type: Number,
    required: true
  },
  sourcePosition: {
    type: String,
    required: true
  },
  targetPosition: {
    type: String,
    required: true
  },
  markerEnd: {
    type: String,
    required: false
  },
  style: {
    type: Object,
    required: false
  },
  sourceNode: {
    type: Object,
    required: false
  },
  targetNode: {
    type: Object,
    required: false
  },
  selected: {
    type: Boolean,
    required: false
  },
  data: {
    type: Object,
    required: false
  },
  label: {
    type: String,
    required: false
  },
  selectable: {
    type: Boolean,
    required: false
  },
  hoverEdgeId: {
    type: String,
    required: false
  },
  nodeListVisible: {
    type: Boolean,
    required: false
  }
})
const addBtnShow = ref(false)

watch(
  () => props.nodeListVisible,
  (val) => {
    if (!val) {
      addBtnShow.value = false
    }
  }
)

const emit = defineEmits(['showQuickConnect'])

//判断是否连接了自己的前代节点
const isLoopback = computed(() => {
  return (
    props.sourceX > props.targetX + props.targetNode.dimensions.width
  )
})
// 获取贝塞尔路径
const path = computed(() => {
  if (isLoopback.value) {
    let centerX, centerY
    centerX = (props.sourceX + props.targetX) / 2
    centerY = Math.min(props.sourceY, props.targetY) - 35
    return getSmoothStepPath({
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
      centerX,
      centerY,
      ...props
    })
  }
  return getBezierPath(props)
})
// 获取线条样式
const strokeStyle = computed(() => {
  // 主流程连线（next / next-false）更粗；参数连线更细，便于一眼区分
  const isMainFlow = props.sourceHandleId === 'next' || props.sourceHandleId === 'next-false'
  return {
    stroke: props.selected ? '#1d1d1f' : '#c3c3ca',
    strokeWidth: isMainFlow ? 3 : 1.5
  }
})
</script>

<script>
export default {
  inheritAttrs: false
}
</script>

<style lang="less" scoped>
:deep(.vue-flow__edge-path) {
  stroke: #c3c3ca;
}
.selected {
  z-index: 101;
  button {
    border-color: #1d1d1f;
  }
}
.add-btn {
  width: 24px;
  height: 24px;
  border: 2px solid var(--mac-separator);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--mac-shadow-2);
  &:hover {
    background: var(--color-fill-2);
    transform: scale(1.2);
  }
}
</style>
