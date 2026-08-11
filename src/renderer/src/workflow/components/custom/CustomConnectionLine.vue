<script setup>
const props = defineProps({
  sourceNode: {
    type: Object,
    required: true
  },
  sourceHandle: {
    type: Object,
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
  }
})
import { computed } from 'vue'
import { getBezierPath } from '@vue-flow/core'
const path = computed(() => getBezierPath(props))
const strokeColor = computed(() => {
  return '#b1b1b7'
})
</script>

<template>
  <g>
    <path
      v-if="
        sourceHandle.id === 'next' || sourceHandle.id === 'next-false' || sourceHandle.id === 'prev'
      "
      class="vue-flow__connection animated"
      fill="none"
      stroke="#b1b1b7"
      :stroke-width="4"
      :d="path[0]"
    />
    <path
      v-else
      class="vue-flow__connection animated"
      fill="none"
      :stroke="strokeColor"
      :stroke-width="1.5"
      :d="path[0]"
    />

    <circle :cx="targetX" :cy="targetY" fill="#333" :r="2" stroke="#333" :stroke-width="1.5" />
  </g>
</template>
