<template>
  <div class="loading-more-status">{{ hasMore ? '加载中...' : '没有更多了' }}</div>
</template>

<script setup>
const props = defineProps({
  hasMore: {
    type: Boolean,
    default: true
  }
})
</script>

<style scoped>
.loading-more-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0;
  color: var(--color-text-3);
  &::after,
  &::before {
    content: '';
    display: block;
    width: 50px;
    height: 1px;
    margin: 0 16px;
    background-color: var(--color-border-2);
  }
}
</style>
