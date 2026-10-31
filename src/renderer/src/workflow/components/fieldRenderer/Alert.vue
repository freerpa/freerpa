<template>
  <div class="alert-field-container">
    <a-alert :type="field.alertType || 'info'">
      {{ field.content || field.description || field.default || '' }}
    </a-alert>
  </div>
</template>

<script setup>
defineProps({
  field: {
    type: Object,
    required: true
  }
})
</script>

<style scoped lang="less">
.alert-field-container {
  width: 100%;

  // 与同尺寸的表单控件等高
  :deep(.arco-alert) {
    height: var(--field-control-height, 24px);
    padding: 0 12px;
    font-size: var(--field-font-size, 12px);
    line-height: var(--field-control-height, 24px);
  }
}
</style>
