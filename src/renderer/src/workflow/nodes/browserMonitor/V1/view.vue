<template>
  <div class="browser-node-view">
    <!-- 控制按钮 -->
    <a-button
      :disabled="!status || !isExecuting"
      type="secondary"
      size="mini"
      long
      @click="isMonitoring = !isMonitoring"
    >
      <template #icon><icon-desktop /></template>
      查看页面
    </a-button>
  </div>
  <a-modal
    v-model:visible="isMonitoring"
    :width="modalWH.width"
    :height="modalWH.height"
    :footer="false"
    :body-style="{ padding: 0 }"
    render-to-body
  >
    <template #title>
      <div class="monitorTitle">
        <a-button-group size="mini">
          <a-popover position="bl">
            <a-button> <RiLink size="14" /> </a-button>
            <template #content>
              <a-input-search
                :style="{ width: '320px' }"
                placeholder="请输入URL"
                v-model="urlValue"
                button-text="前往"
                search-button
                allow-clear
                @press-enter="handleAction('goto', urlValue)"
                @search="handleAction('goto', $event)"
              />
            </template>
          </a-popover>
          <a-popover position="bl">
            <a-button> <RiKeyboardBoxLine size="14" /> </a-button>
            <template #content>
              <a-input-search
                :style="{ width: '320px' }"
                placeholder="输入文本"
                v-model="typeValue"
                button-text="输入"
                search-button
                allow-clear
                @press-enter="handleAction('input', typeValue)"
                @search="handleAction('input', $event)"
              />
            </template>
          </a-popover>
          <a-button @click="handleAction('refresh')"> <RiResetRightLine size="14" /> </a-button>
          <a-button @click="handleAction('backward')"> <RiArrowLeftSLine size="14" /> </a-button>
          <a-button @click="handleAction('forward')"> <RiArrowRightSLine size="14" /> </a-button>
        </a-button-group>
      </div>
    </template>
    <canvas ref="canvas" class="monitor-canvas"></canvas>
  </a-modal>
</template>

<script setup>
import { ref, inject, computed, reactive, watch } from 'vue'
import { useElementBounding } from '@vueuse/core'
import { IconDesktop } from '@arco-design/web-vue/es/icon'
import {
  RiLink,
  RiKeyboardBoxLine,
  RiResetRightLine,
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiArrowLeftSLine,
  RiArrowRightSLine
} from '@remixicon/vue'
const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

// 状态相关
const status = ref(false)
// 注入的方法
const sendNodeEvent = inject('sendNodeEvent')
const isExecuting = inject('isExecuting')
const urlValue = ref('')
const typeValue = ref('')
// 状态相关
const canvas = ref(null)
const isMonitoring = ref(false)
const aspectRatio = ref(16 / 9) // 默认宽高比
const zoomLevel = computed(() => {
  return canvasWH.value.width / viewport.value.width
})
const viewport = ref({
  width: 1280,
  height: 720
})
const modalWH = computed(() => {
  const WH = {
    width: viewport.value.width,
    height: viewport.value.height
  }
  const maxWidth = window.screen.availWidth * 0.9
  const maxHeight = window.screen.availHeight * 0.9
  if (WH.width > maxWidth) {
    WH.width = maxWidth
    WH.height = WH.width / aspectRatio.value
  }
  if (WH.height > maxHeight) {
    WH.height = maxHeight
    WH.width = WH.height * aspectRatio.value
  }
  return WH
})
const canvasWH = computed(() => {
  const rect = reactive(useElementBounding(canvas.value))
  const width = rect.width
  return {
    width,
    height: width / aspectRatio.value
  }
})

const handleAction = (action, data) => {
  sendNodeEvent({
    type: action,
    data: data
  })
}

watch(isMonitoring, (newVal) => {
  if (newVal) {
    addEventListener()
    sendNodeEvent({
      type: 'start'
    })
  } else {
    sendNodeEvent({
      type: 'end'
    })
    removeEventListener()
  }
})
// 处理节点事件
const onNodeEvent = ({ type, data }) => {
  switch (type) {
    case 'status':
      status.value = data
      break
    case 'init':
      viewport.value = data.viewport
      aspectRatio.value = data.viewport.width / data.viewport.height
      break
    case 'image':
      if (isMonitoring.value && canvas.value) {
        renderImage(data)
      }
      break
  }
}

// 渲染图像到canvas
const renderImage = (base64Data) => {
  const img = new Image()
  img.onload = () => {
    if (canvas.value) {
      const ctx = canvas.value.getContext('2d')
      // 计算画布尺寸，使用固定宽高比
      const containerWidth = canvasWH.value.width
      const containerHeight = canvasWH.value.height
      // 考虑设备像素比，提高清晰度
      const dpr = window.devicePixelRatio || 1
      canvas.value.width = containerWidth * dpr
      canvas.value.height = containerHeight * dpr
      // 缩放上下文以匹配DPR
      ctx.scale(dpr, dpr)
      // 绘制图像
      ctx.clearRect(0, 0, containerWidth, containerHeight)
      ctx.drawImage(img, 0, 0, containerWidth, containerHeight)
    }
  }
  img.src = 'data:image/webp;base64,' + base64Data
}
const getRelativePosition = (e) => {
  const rect = canvas.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / zoomLevel.value
  const y = (e.clientY - rect.top) / zoomLevel.value
  return { x, y }
}
const buttonMap = {
  0: 'left',
  1: 'middle',
  2: 'right'
}
// 鼠标事件处理
const handleMouseMove = (e) => {
  if (isMonitoring.value) {
    const { x, y } = getRelativePosition(e)
    sendNodeEvent({
      type: 'mouseMove',
      data: { x, y }
    })
  }
}

const handleMouseDown = (e) => {
  if (isMonitoring.value) {
    const { x, y } = getRelativePosition(e)
    sendNodeEvent({
      type: 'mouseDown',
      data: { x, y, button: buttonMap[e.button] }
    })
  }
}

const handleMouseUp = (e) => {
  if (isMonitoring.value) {
    const { x, y } = getRelativePosition(e)
    sendNodeEvent({
      type: 'mouseUp',
      data: { x, y, button: buttonMap[e.button] }
    })
  }
}

const handleWheel = (e) => {
  if (isMonitoring.value) {
    e.preventDefault()
    const { x, y } = getRelativePosition(e)
    sendNodeEvent({
      type: 'mouseWheel',
      data: { x, y, deltaX: e.deltaX, deltaY: e.deltaY }
    })
  }
}

const addEventListener = (eventName, handler) => {
  // 添加事件监听器
  canvas.value.addEventListener('mousemove', handleMouseMove)
  canvas.value.addEventListener('mousedown', handleMouseDown)
  canvas.value.addEventListener('mouseup', handleMouseUp)
  canvas.value.addEventListener('wheel', handleWheel)
}
const removeEventListener = (eventName, handler) => {
  // 移除事件监听器
  canvas.value.removeEventListener('mousemove', handleMouseMove)
  canvas.value.removeEventListener('mousedown', handleMouseDown)
  canvas.value.removeEventListener('mouseup', handleMouseUp)
  canvas.value.removeEventListener('wheel', handleWheel)
}

watch(isExecuting, (newVal) => {
  if (!newVal) {
    isMonitoring.value = false
  }
})

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.monitor-canvas {
  width: 100%;
  cursor: auto;
}
.arco-btn {
  line-height: 1;
}
.monitorTitle {
  display: flex;
  justify-content: flex-start;
  width: 100%;
  gap: 16px;
  position: absolute;
  left: 8px;
}
</style>
