<template>
  <div class="download-listener-view">
    <a-progress :status="status" :percent="percent" />
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

const percent = ref(0)
const status = ref('normal')
// 处理节点事件
const onNodeEvent = async ({ type, data }) => {
  if (type == 'progress') {
    // 添加记录
    percent.value = data.receivedBytes / data.totalBytes
    if (data.state === 'completed') {
      status.value = 'success'
    } else if (data.state === 'canceled') {
      status.value = 'normal'
      percent.value = 0
    } else if (data.state === 'interrupted') {
      status.value = 'danger'
    }
  }
  if (type == 'start') {
    status.value = 'normal'
    percent.value = 0
  }
}

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.download-listener-view {
  width: 100%;
}
</style>
