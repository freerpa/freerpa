<template>
  <div class="color-picker">
    <a-color-picker
      v-model="value"
      :disabled="field.disabled || isExecuting"
      :format="field.format || 'hex'"
      :preset-colors="field.presetColors"
      size="mini"
      showText
      showPreset
      :trigger-props="{ trigger: 'hover' }"
    />
    <a-button class="clear-btn" type="secondary" size="mini" shape="circle" @click="clear">
      <template #icon><icon-close /></template>
    </a-button>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { useFieldWatch } from './composables/useFieldValue'
import { IconClose } from '@arco-design/web-vue/es/icon'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const isExecuting = inject('isExecuting')
const value = defineModel()
useFieldWatch(props, value)

const clear = () => {
  value.value = '#00000000'
}
</script>
<style lang="less" scoped>
.color-picker {
  display: flex;
  align-items: center;
  background: var(--color-fill-2);
  border-radius: var(--border-radius-small);
  overflow: hidden;
}
:deep(.arco-color-picker-preview){
  border-radius: var(--border-radius-small);
}
.clear-btn {
  width: 16px;
  height: 16px;
  margin: 4px;
}
</style>
