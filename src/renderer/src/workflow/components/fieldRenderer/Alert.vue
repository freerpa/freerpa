<template>
  <div class="alert-field-container">
    <a-alert :type="field.alertType || 'info'" style="height: 24px; padding: 0px 12px; font-size: 12px">
      {{ field.content || field.description || field.default || '' }}
    </a-alert>
  </div>
</template>

<script setup>
const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})
</script>

<style scoped lang="less">
.alert-field-container {
  width: 100%;
}
</style>
