<template>
  <div class="end-workflow-view">
    <a-space>
      结束当前流程
      <a-tooltip content="点击右上角可配置输出项作为父节点的输出">
        <icon-question-circle />
      </a-tooltip>
    </a-space>
  </div>
</template>

<script setup>
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon'
const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})
</script>

<style scoped lang="less"></style>
