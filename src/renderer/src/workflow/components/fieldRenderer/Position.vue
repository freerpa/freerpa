<template>
  <div class="position-container">
    <a-input-group>
      <a-input-number :style="{ width: '50%' }" placeholder="X坐标" v-model="value.x">
        <template #prefix> x </template>
      </a-input-number>
      <a-input-number :style="{ width: '50%' }" placeholder="Y坐标" v-model="value.y">
        <template #prefix> y </template>
      </a-input-number>
    </a-input-group>
    <a-button @mousedown="startGetMousePos" @mouseup="stopGetMousePos" @mouseleave="stopGetMousePos">
      <svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M862.08 480A350.08 350.08 0 0 0 544 161.92V64h-64v97.92A350.08 350.08 0 0 0 161.92 480H64v64h97.92a350.08 350.08 0 0 0 318.08 318.08V960h64v-97.92a350.08 350.08 0 0 0 318.08-318.08H960v-64h-97.92zM480 798.08A287.232 287.232 0 0 1 225.92 544H480v254.08z m0-318.08H225.92A287.232 287.232 0 0 1 480 225.92V480z m64-254.08c133.76 14.72 239.36 120.32 254.08 254.08H544V225.92z m0 572.16V544h254.08a287.232 287.232 0 0 1-254.08 254.08z"
          fill="currentColor"
        ></path>
      </svg>
    </a-button>
  </div>
</template>
<script setup>
import { useFieldWatch } from './composables/useFieldValue'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const value = defineModel()
useFieldWatch(props, value)

let interval = null

const startGetMousePos = () => {
  window.electronAPI.system.screenshot()
  interval = setInterval(async () => {
    const pos = await window.electronAPI.app.getMousePos()
    value.value.x = pos.x
    value.value.y = pos.y
  }, 10)
}

const stopGetMousePos = () => {
  clearInterval(interval)
  window.electronAPI.system.stopGetMousePos()
}
</script>

<style lang="less" scoped>
.position-container {
  display: flex;
  align-items: center;
  justify-content: center;
  .icon {
    width: 1em;
    height: 1em;
  }
}
</style>
