<template>
  <div class="audio-preview-view">
    <audio ref="audioRef" class="audio-player" :src="audio" controls autoplay />
  </div>
</template>

<script setup>
import { ref } from 'vue'
const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const audio = ref('')
const audioRef = ref(null)

// 处理节点事件
const onNodeEvent = async (params) => {
  if (params.type === 'preview') {
    audio.value = params.data.audio
  }
}

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.audio-preview-view {
  width: 100%;
  height: 100%;
  display: flex;
  background-color: #f1f3f4;
  border-radius: var(--border-radius-small);
}
</style>
