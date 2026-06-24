<template>
  <div class="notice-view">
    <!-- 通知列表 -->
    <div class="notice-list">
      <a-space direction="vertical" style="width: 100%">
        <a-alert type="error" v-if="notices.length > 0">
          <template #icon>
            <icon-sound-fill />
          </template>
          {{ notices.length }} 条通知
        </a-alert>

        <div class="output-content">
          <a-list :max-height="180" scrollbar :data="notices">
            <template #header>
              <a-space :size="40">
                <small>消息</small>
                <small class="clearbtn" @click="clearNotices">
                  <icon-delete />
                </small>
              </a-space>
            </template>
            <template #item="{ item, index }">
              <a-list-item :key="index" class="debug-output-item">
                <a-list-item-meta>
                  <template #title>
                    <span>{{ item.message }}</span>
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </div>
      </a-space>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted, inject, watch, computed } from 'vue'
import { IconSoundFill, IconDelete } from '@arco-design/web-vue/lib/icon'
import { useFlowStore } from '@/workflow/store'
import { storeToRefs } from 'pinia'
const workflowId = inject('workflowId')
const flowStore = useFlowStore(workflowId)
const { noticeNum } = storeToRefs(flowStore)
import notice from '@/assets/sounds/notice.mp3'

const props = defineProps({
  node: {
    type: Object,
    default: {}
  }
})

const config = computed(() => props.node.config)

let audio = null
if (config.value.playSound) {
  audio = new Audio(notice)
}

watch(config.value, (config) => {
  if (config.playSound) {
    audio.loop = config.loop
  }
})

// 通知列表
const notices = ref([])
watch(
  () => notices.value,
  (newVal) => {
    if (!config.value.playSound) {
      return
    }
    if (newVal.length > 0) {
      audio?.play()
    } else {
      audio?.pause()
      audio.currentTime = 0
    }
  },
  { deep: true }
)

onUnmounted(() => {
  clearNotices()
})

// 清空通知
const clearNotices = () => {
  noticeNum.value = noticeNum.value - notices.value.length
  notices.value = []
}

// 处理节点事件
const onNodeEvent = ({ type, data }) => {
  if (type === 'notice') {
    notices.value.push(data)
    noticeNum.value = noticeNum.value + 1
  }
  if (type === 'stop') {
    if (!config.value.playSound) {
      return
    }
    audio?.pause()
    audio.currentTime = 0
  }
}

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.notice-view {
  .output-content {
    width: 100%;
    border-radius: var(--border-radius-small);
    .clearbtn {
      display: flex;
      align-items: center;
      cursor: pointer;
      position: absolute;
      right: 3px;
      padding: 5px;
      border-radius: var(--border-radius-small);
      &:hover {
        background-color: var(--color-fill-2);
      }
      &:active {
        background-color: var(--color-fill-3);
      }
    }
    :deep(.arco-list-header) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px !important;
    }
    .debug-output-item {
      padding: 0 10px !important;
    }
  }
}
</style>
