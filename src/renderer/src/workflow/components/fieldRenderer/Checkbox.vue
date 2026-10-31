<template>
  <a-checkbox-group v-model="value" :options="options" :disabled="field.disabled" class="checkbox-group" />
</template>

<script setup>
import { useFieldWatch } from './composables/useFieldValue'
import { useRemoteOptions } from './composables/useRemoteOptions'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const value = defineModel()
useFieldWatch(props, value)

// 远程/静态选项统一加载
const { options, loadOptions } = useRemoteOptions(props.field, () => value.value)
loadOptions()
</script>
<style scoped>
.checkbox-group {
  /* 与同尺寸的表单控件等高，选项多时自动换行 */
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-height: var(--field-control-height, 24px);
}
</style>
