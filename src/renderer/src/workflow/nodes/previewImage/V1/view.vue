<template>
  <div class="image-preview-view">
    <a-image
      class="image-preview"
      ref="imageRef"
      width="100%"
      :src="image"
      show-loader
      @click.stop="showPreview(image)"
      :preview="false"
      draggable="false"
    />
    <template v-if="image && compareImage">
      <div class="slider" :style="{ right: `${width}%` }" @pointerdown="handlePointerDown">
        <div class="slider-bar"></div>
      </div>
      <div class="image-preview-compare" :style="{ width: `${width}%` }">
        <a-image
          style="position: absolute; right: 0"
          height="100%"
          :src="compareImage"
          show-loader
          @click.stop="showPreview(compareImage)"
          :preview="false"
          draggable="false"
        >
          <template #actions> 1 </template>
        </a-image>
      </div>
    </template>
    <a-image-preview :src="preViewImage" v-model:visible="previewVisible">
      <template #actions>
        <div class="arco-image-preview-toolbar-action" @click="downloadImage">
          <a-tooltip content="保存图片">
            <span class="arco-image-preview-toolbar-action-content"><icon-download /></span>
          </a-tooltip>
        </div>
      </template>
    </a-image-preview>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { useElementBounding } from '@vueuse/core'
import { useFlowStore } from '@/workflow/store'
import { IconDownload } from '@arco-design/web-vue/es/icon'

// 工作流ID
const workflowId = inject('workflowId')
// 工作流store
const flowStore = useFlowStore(workflowId)

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const image = ref('')
const compareImage = ref('')

const imageRef = ref(null)
const { width: imageWidth, height: imageHeight } = useElementBounding(imageRef)

const width = ref(50)

let startX = 0
let isDragging = false
const handlePionterUp = (e) => {
  isDragging = false
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePionterUp)
}
const handlePointerDown = (e) => {
  startX = e.clientX
  isDragging = true
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePionterUp)
}

const handlePointerMove = (e) => {
  const zoom = flowStore.vueFlowRef.getViewport().zoom
  if (!isDragging) return
  const deltaX = ((e.clientX - startX) / zoom / imageWidth.value) * 100
  width.value -= deltaX
  if (width.value <= 0) {
    width.value = 0
  }
  if (width.value >= 100) {
    width.value = 100
  }
  startX = e.clientX
}

// 处理节点事件
const onNodeEvent = async (params) => {
  if (params.type === 'preview') {
    // 添加记录
    image.value = params.data.image
    compareImage.value = params.data.compareImage
  }
}

const previewVisible = ref(false)
const preViewImage = ref('')
const showPreview = (image) => {
  previewVisible.value = true
  preViewImage.value = image
}

const downloadImage = () => {
  const a = document.createElement('a')
  a.href = preViewImage.value
  a.download = 'image.jpg'
  a.click()
}

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.image-preview-view {
  position: relative;
  .image-preview {
    min-height: 285px;
  }
  .slider {
    position: absolute;
    top: 0;
    right: 0;
    width: 1px;
    height: 100%;
    background-color: #fff;
    z-index: 1000;
    cursor: col-resize;
    &-bar {
      position: absolute;
      top: 50%;
      left: 1px;
      width: 30px;
      height: 30px;
      transform: translate(-50%, -50%);
      border: 1px solid #fff;
      border-radius: 20px;
      z-index: 1001;
      cursor: col-resize;
    }
  }
  .image-preview-compare {
    // background: rgba(255,255,255);
    height: 100%;
    position: absolute;
    top: 0;
    right: 0;
    overflow: hidden;
  }
}
</style>
