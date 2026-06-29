<template>
  <a-space>
    <span>等待时间:</span>
    <template v-if="node.config.mode === 'fixed'">
      <a-tag size="mini" color="orange" bordered>{{ node.config.duration / 1000 }}秒</a-tag>
    </template>
    <template v-else>
      <a-tag v-if="duration > 0" size="mini" color="orange" bordered>
        {{ duration / 1000 }}秒
      </a-tag>
      <a-tag v-else size="mini" color="orange" bordered>
        {{ node.config.minDuration / 1000 }}秒 - {{ node.config.maxDuration / 1000 }}秒
      </a-tag>
    </template>
  </a-space>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const duration = ref(0)
// 处理节点事件
const onNodeEvent = async (params) => {
  // 添加记录
  duration.value = params.data
}

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.delay-v2-view {
  display: flex;
  align-items: center;
}
</style>
