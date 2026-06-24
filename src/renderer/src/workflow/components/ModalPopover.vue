<template>
  <teleport to="body">
    <div
      v-if="visible"
      @click="visible = false"
      :style="{ zIndex: maskZIndex }"
      class="mask-popover"
    ></div>
  </teleport>
  <a-popover
    title=""
    :popup-visible="visible"
    popup-container="body"
    :position="position"
    v-bind="popoverProps"
  >
    <template #title>
      <slot name="title">{{ title }}</slot>
    </template>
    <template #content>
      <div v-if="visible" class="popover-content scrollbar">
        <slot name="content"></slot>
      </div>
    </template>
    <div
      @click.stop="trigger === 'click' ? (visible = true) : null"
      class="popover-trigger"
      :style="triggerStyle"
    >
      <slot></slot>
    </div>
  </a-popover>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  popoverProps: {
    type: Object,
    default: {}
  },
  trigger: {
    type: String,
    default: 'click'
  },
  position: {
    type: String,
    default: 'right'
  },
  triggerStyle: {
    type: [String, Object],
    default: 'none'
  }
})

const visible = defineModel('visible', {
  default: false
})
const maskZIndex = ref(0)

const emits = defineEmits(['visible-change'])
watch(visible, (newVal) => {
  emits('visible-change', newVal)
  if (newVal) {
    nextTick(() => {
      const popover = document.querySelector('.arco-popover')
      maskZIndex.value = popover.style.zIndex
    })
  }
})
defineExpose({
  visible
})
</script>
<style scoped lang="less">
:deep(.arco-tabs-content) {
  padding: 0;
}
.mask-popover {
  -webkit-app-region: no-drag;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.popover-content {
  padding: 0;
  min-width: 300px;
  max-width: 45vw;
  max-height: 90vh;
  overflow-y: auto;
  height: fit-content;
}
.popover-trigger {
  height: fit-content;
  width: fit-content;
}

</style>
