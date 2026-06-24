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
import { getAllSuccessorNodes } from '../../utils'
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

const edgeStatus = ref('initializing')
//判断是否连接了自己的前代节点
const isLoopback = computed(() => {
  // const successorNodes = getAllSuccessorNodes(
  //   flowStore.vueFlowRef?.getEdges,
  //   flowStore.vueFlowRef?.getNodes,
  //   props.targetNode.id
  // )
  return (
    // successorNodes.includes(props.sourceNode) &&
    props.sourceX > props.targetX + props.targetNode.dimensions.width
  )
})
console.log('isLoopback:', isLoopback.value)
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
  const style = { stroke: '#b1b1b7', strokeWidth: 4 }
  if (props.sourceHandleId !== 'next' && props.sourceHandleId !== 'next-false') {
    style.strokeWidth = 1.5
    style.stroke = '#b1b1b7'
  }
  // 选中时，线条颜色加深
  if (props.selected) {
    style.stroke = '#000'
  }
  return style
})
</script>

<script>
export default {
  inheritAttrs: false
}
</script>

<style lang="less" scoped>
:deep(.vue-flow__edge-path) {
  stroke: #b1b1b7 !important;
  stroke-width: 3px;
}
.vue-flow__edge--selected .vue-flow__edge-path {
  stroke: #000;
  stroke-width: 3px;
}
.selected {
  z-index: 101;
  button {
    border-color: #000;
  }
}
.add-btn {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--color-bg-1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  &:hover {
    background: var(--color-fill-2);
    transform: scale(1.2);
  }
}
</style>
