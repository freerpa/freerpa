<template>
  <div class="base-timer-node-view">
    <a-tag style="width: 100%">
      <a-tooltip>
        <template #content> 使用【操作定时器】节点清零、增加、减少计数。 </template>
        <icon-question-circle />
      </a-tooltip>
      &nbsp;当前计时：<b>{{ time }}</b>&nbsp;秒
    </a-tag>
  </div>
</template>

<script setup>
import { ref,onBeforeUnmount } from 'vue'
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon'
const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

// 状态相关
let timer = null
const time = ref(0)
const startTimer = () => {
  timer = setInterval(() => {
    time.value++
  }, 1000)
}
const stopTimer = () => {
  clearInterval(timer)
}

// 处理节点事件
const onNodeEvent = ({ type, data }) => {
  switch (type) {
    case 'start':
      startTimer()
      time.value = data
      break
    case 'stop':
      stopTimer()
      time.value = data
      break
    case 'clear':
      time.value = 0
      break
    default:
      break
  }
}
onBeforeUnmount(() => {
  stopTimer()
})
defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.base-timer-node-view {
}
</style>
