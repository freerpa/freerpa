<template>
    <a-checkbox-group
    v-model="value"
    :options="options"
    :disabled="field.disabled"
  />
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
  min-height: 24px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
</style>
