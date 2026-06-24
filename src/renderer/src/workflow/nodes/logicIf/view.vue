<template>
  <div class="logic-if-view">
    <a-space>
      <a-tag type="primary" :color="node.config.matchType === 'and' ? 'blue' : 'green'">
        {{ node.config.matchType === 'and' ? '满足所有条件' : '满足任一条件' }}
      </a-tag>
      <a-tag type="primary" :color="node.config.rules.length > 0 ? 'blue' : 'red'">
        条件数量 ：{{ node.config.rules.length }}
      </a-tag>
    </a-space>
  </div>
</template>

<script setup>
const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})
</script>

<style scoped lang="less">
.logic-if-view {
  padding: 3px 0;
}
</style>
