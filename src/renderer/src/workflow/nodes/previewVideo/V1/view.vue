<template>
  <div class="video-preview-view">
    <video v-if="video" ref="videoRef" class="video-player" :src="video" controls />
    <div v-else class="no-video">
      <icon-play-circle size="60px" />
      <p>暂无视频</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { IconPlayCircle } from '@arco-design/web-vue/es/icon'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const video = ref('')
const videoRef = ref(null)

// 处理节点事件
const onNodeEvent = async (params) => {
  if (params.type === 'preview') {
    video.value = params.data.video
  }
}

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.video-preview-view {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f7f8fa;
  border-radius: var(--border-radius-small);

  .no-video {
    text-align: center;
    color: #c9cdd4;

    p {
      font-size: 14px;
    }
  }
}
</style>
