<template>
  <div class="counter-node-view">
    <a-tag style="width: 100%">
      <a-tooltip>
        <template #content> 使用【操作计数器】节点清零、增加、减少计数。 </template>
        <icon-question-circle />
      </a-tooltip>
      &nbsp;当前计数：<b>{{ count }}</b>
    </a-tag>
  </div>
</template>

<script setup>
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon'
import { ref } from 'vue'
const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})
// 计数
const count = ref(props.node.config.initialValueCount || 0)
// 处理节点事件
const onNodeEvent = ({ type, data }) => {
  switch (type) {
    case 'count':
      count.value = data
      break
  }
}
defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.counter-node-view {
}
</style>
